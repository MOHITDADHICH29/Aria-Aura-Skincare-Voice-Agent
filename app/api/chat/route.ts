import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { buildAriaSystemPrompt } from "@/lib/prompt";
import { geminiToolDeclarations } from "@/lib/tools";
import { getOrderDetails, cancelOrder } from "@/lib/orders";
import { createSupportTicket } from "@/lib/tickets";
import { toDisplayText } from "@/lib/language";
import { sanitizeForSpeech } from "@/lib/tts";
import {
  DEFAULT_GEMINI_MODEL,
  MAX_HISTORY_TURNS,
  MAX_OUTPUT_TOKENS,
} from "@/lib/config";
import { Language } from "@/lib/types";

// Reusable server-side SDK client instance
let globalAiClient: GoogleGenAI | null = null;
function getAiClient(apiKey: string): GoogleGenAI {
  if (!globalAiClient) {
    globalAiClient = new GoogleGenAI({ apiKey });
  }
  return globalAiClient;
}

interface ClientMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const FALLBACK_MODELS = [
  process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_MODEL,
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.5-flash-lite",
  "gemini-3-flash-preview",
];

function executeToolCall(name: string, args: Record<string, unknown>): unknown {
  switch (name) {
    case "get_order_details":
      return getOrderDetails(String(args.order_id || ""));
    case "cancel_order":
      return cancelOrder(String(args.order_id || ""));
    case "create_support_ticket":
      return createSupportTicket(
        String(args.issue_summary || ""),
        args.order_id ? String(args.order_id) : undefined,
        (args.priority as "LOW" | "MEDIUM" | "HIGH") || "MEDIUM"
      );
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: "API key is not configured on the server. Please check your environment variables.",
        toolCalls: [],
      });
    }

    const body = await req.json().catch(() => ({}));
    const rawMessages: ClientMessage[] = Array.isArray(body.messages) ? body.messages : [];
    const language: Language = body.language === "hinglish" ? "hinglish" : "en";

    // Trim conversation history to last MAX_HISTORY_TURNS turns to reduce prompt latency
    const recentMessages = rawMessages.slice(-MAX_HISTORY_TURNS);

    // Build contents with strictly Romanized display text
    const contents: any[] = recentMessages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: toDisplayText(msg.content) }],
    }));

    if (contents.length === 0) {
      contents.push({ role: "user", parts: [{ text: "Hello" }] });
    }

    const ai = getAiClient(apiKey);
    const executedToolCalls: Array<{
      name: string;
      args: Record<string, unknown>;
      result: unknown;
    }> = [];

    const modelsToTry = Array.from(new Set(FALLBACK_MODELS));
    let finalReply = "";
    let loopCount = 0;
    const maxIterations = 4;
    const systemInstruction = buildAriaSystemPrompt(language);

    while (loopCount < maxIterations) {
      loopCount++;
      let response: any = null;
      let lastError: Error | null = null;
      let successfulModel = "";

      for (const model of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
              tools: geminiToolDeclarations,
              temperature: 0.2, // low temperature for fast, deterministic speech
              maxOutputTokens: MAX_OUTPUT_TOKENS, // 120 tokens keeps voice responses short and low-latency
            },
          });
          successfulModel = model;
          break;
        } catch (err: unknown) {
          lastError = err instanceof Error ? err : new Error(String(err));
          console.warn(`[Chat API] Model '${model}' error: ${lastError.message}, trying next...`);
        }
      }

      if (!response) {
        throw lastError || new Error("Failed to receive response from Gemini models.");
      }

      const candidate = response.candidates?.[0];
      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        const fc = functionCalls[0];
        const toolResult = executeToolCall(fc.name, (fc.args || {}) as Record<string, unknown>);
        executedToolCalls.push({
          name: fc.name,
          args: (fc.args || {}) as Record<string, unknown>,
          result: toolResult,
        });

        if (candidate?.content) {
          contents.push(candidate.content);
        } else {
          contents.push({
            role: "model",
            parts: [{ functionCall: fc }],
          });
        }

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

        continue;
      }

      const textParts =
        candidate?.content?.parts?.filter(
          (p: any) => typeof p.text === "string" && p.text.trim().length > 0
        ) || [];

      finalReply = textParts.map((p: any) => p.text).join(" ").trim() || response.text || "";
      break;
    }

    if (!finalReply) {
      finalReply =
        language === "hinglish"
          ? "Aapka order dekhne ke liye kya aap mujhe apna order ID de sakte hain?"
          : "I would be happy to help with that. Could you please share your order ID?";
    }

    // Guarantee: passed through toDisplayText() and sanitizeForSpeech()
    const safeDisplayReply = toDisplayText(finalReply);
    const cleanSpeechReply = sanitizeForSpeech(safeDisplayReply);

    return NextResponse.json({
      reply: cleanSpeechReply,
      toolCalls: executedToolCalls,
    });
  } catch (err) {
    console.error("[Chat API Exception]", err);
    return NextResponse.json({
      reply: "Sorry, I had a momentary connection hiccup. Could you please repeat that?",
      toolCalls: [],
    });
  }
}
