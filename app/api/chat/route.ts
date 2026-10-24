import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { ARIA_SYSTEM_PROMPT } from "@/lib/prompt";
import { geminiToolDeclarations, executeTool, ToolCallRecord } from "@/lib/tools";

interface ClientMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const FALLBACK_MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-flash-lite-latest",
  "gemini-3.6-flash",
];

function sanitizeForTTS(text: string): string {
  if (!text) return "";
  return text
    // Remove markdown asterisks, hashtags, backticks, tildes
    .replace(/[*#`_~]/g, "")
    // Remove emojis
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      ""
    )
    // Remove bullet points / dash at start of line
    .replace(/^[-•*]\s+/gm, "")
    // Collapse multiple whitespace
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[Chat API] Missing GEMINI_API_KEY environment variable");
      return NextResponse.json({
        reply: "API key is not configured on the server. Please check your environment variables.",
        toolCalls: [],
      });
    }

    const body = await req.json().catch(() => ({}));
    const rawMessages: ClientMessage[] = Array.isArray(body.messages) ? body.messages : [];

    // Safeguard: max 40 turns per session
    if (rawMessages.length > 40) {
      return NextResponse.json({
        reply: "We have reached the maximum turns for this voice session. Thank you for contacting Aura Skincare!",
        toolCalls: [],
      });
    }

    // Trim conversation history to last ~20 turns for optimal latency
    const recentMessages = rawMessages.slice(-20);

    // Build initial contents
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents: any[] = recentMessages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    if (contents.length === 0) {
      contents.push({ role: "user", parts: [{ text: "Hello" }] });
    }

    const ai = new GoogleGenAI({ apiKey });
    const executedToolCalls: ToolCallRecord[] = [];

    const modelsToTry = Array.from(new Set(FALLBACK_MODELS));
    let finalReply = "";
    let loopCount = 0;
    const maxIterations = 4;

    while (loopCount < maxIterations) {
      loopCount++;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let response: any = null;
      let lastError: Error | null = null;
      let successfulModel = "";

      // Try with candidate models to withstand 429/503/404 rate-limits or spikes
      for (const model of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: ARIA_SYSTEM_PROMPT,
              tools: geminiToolDeclarations,
              temperature: 0.3,
              // 400 tokens ensures thinking tokens + 2 concise spoken sentences are never truncated
              maxOutputTokens: 400,
            },
          });
          successfulModel = model;
          break;
        } catch (err: unknown) {
          lastError = err instanceof Error ? err : new Error(String(err));
          console.warn(`[Chat API] Model '${model}' error: ${lastError.message}, trying next fallback...`);
        }
      }

      if (!response) {
        throw lastError || new Error("Failed to receive response from Gemini models.");
      }

      const candidate = response.candidates?.[0];
      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        const fc = functionCalls[0];
        console.log(`[Chat API Turn ${loopCount}] Model '${successfulModel}' invoked: ${fc.name}`, fc.args);

        const toolResult = executeTool(fc.name, fc.args as Record<string, unknown>);
        executedToolCalls.push({
          name: fc.name,
          args: (fc.args || {}) as Record<string, unknown>,
          result: toolResult,
        });

        // Append model tool call turn
        if (candidate?.content) {
          contents.push(candidate.content);
        } else {
          contents.push({
            role: "model",
            parts: [{ functionCall: fc }],
          });
        }

        // Append tool result turn
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: fc.name,
                response:
                  typeof toolResult === "object" && toolResult !== null
                    ? toolResult
                    : { output: toolResult },
                ...(fc.id ? { id: fc.id } : {}),
              },
            },
          ],
        });

        // Re-query to let Gemini generate spoken answer based on the tool result
        continue;
      }

      // Check text parts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textParts = candidate?.content?.parts?.filter((p: any) => typeof p.text === "string" && p.text.trim().length > 0) || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      finalReply = textParts.map((p: any) => p.text).join(" ").trim() || response.text || "";
      break;
    }

    if (!finalReply) {
      finalReply = "I am here to help with your Aura Skincare orders and products. How can I assist you?";
    }

    const cleanReply = sanitizeForTTS(finalReply);
    console.log(`[Chat API Response] "${cleanReply}"`);

    return NextResponse.json({
      reply: cleanReply,
      toolCalls: executedToolCalls,
    });
  } catch (err) {
    console.error("[Chat API Exception]", err);
    return NextResponse.json({
      reply: "Sorry, I had a small technical hiccup. Could you please say that again?",
      toolCalls: [],
    });
  }
}
