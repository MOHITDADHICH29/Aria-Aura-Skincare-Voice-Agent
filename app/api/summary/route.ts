import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { SUMMARY_SYSTEM_PROMPT } from "@/lib/prompt";
import { toDisplayText } from "@/lib/language";
import { PostCallSummary, Language } from "@/lib/types";
import { DEFAULT_GEMINI_MODEL } from "@/lib/config";

const FALLBACK_MODELS = [
  process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_MODEL,
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.5-flash-lite",
  "gemini-3-flash-preview",
];

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const body = await req.json().catch(() => ({}));
    const transcript = body.transcript || [];
    const toolCalls = body.toolCalls || [];
    const language: Language = body.language === "hinglish" ? "hinglish" : "en";

    // Extract any ticket IDs generated during the call
    const createdTicketIds: string[] = toolCalls
      .filter((t: any) => t.name === "create_support_ticket" && t.result?.ticket_id)
      .map((t: any) => String(t.result.ticket_id));

    if (!transcript || transcript.length === 0) {
      const emptySummary: PostCallSummary = {
        language,
        customer_intent: "OTHER",
        order_id: null,
        resolution_status: "RESOLVED",
        call_summary: "Call connected and ended without customer speech.",
        tools_used: [],
        tickets_created: [],
        escalation: false,
        customer_sentiment: "NEUTRAL",
        follow_up_needed: false,
      };
      return NextResponse.json({ summary: emptySummary });
    }

    if (!apiKey) {
      console.warn("[Summary API] Missing GEMINI_API_KEY");
      const mockSummary: PostCallSummary = {
        language,
        customer_intent: "OTHER",
        order_id: null,
        resolution_status: createdTicketIds.length > 0 ? "ESCALATION_NEEDED" : "RESOLVED",
        call_summary: "Summary generated in mock mode due to unconfigured API key.",
        tools_used: toolCalls.map((t: { name: string }) => t.name),
        tickets_created: createdTicketIds,
        escalation: createdTicketIds.length > 0,
        customer_sentiment: "NEUTRAL",
        follow_up_needed: createdTicketIds.length > 0,
      };
      return NextResponse.json({ summary: mockSummary });
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelsToTry = Array.from(new Set(FALLBACK_MODELS));

    const promptText = `
Please analyze this customer support call transcript and tool executions for Aura Skincare:

PRIMARY LANGUAGE:
${language === "hinglish" ? "Hinglish (Hindi + English in Roman script)" : "English (India)"}

TRANSCRIPT:
${transcript
  .map(
    (t: { speaker: string; text: string; timestamp?: string }) =>
      `[${t.timestamp || "Time"}] ${t.speaker}: ${toDisplayText(t.text)}`
  )
  .join("\n")}

TOOL INVOCATIONS:
${JSON.stringify(toolCalls, null, 2)}

Produce a valid JSON object matching the requested schema with factual accuracy.
CRITICAL: All call_summary text and all string values MUST be written in professional English using ONLY Latin characters. Do not use Devanagari anywhere.
`;

    let response: any = null;
    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          config: {
            systemInstruction: SUMMARY_SYSTEM_PROMPT,
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                language: {
                  type: Type.STRING,
                  enum: ["en", "hinglish"],
                  description: "Primary language of the call",
                },
                customer_intent: {
                  type: Type.STRING,
                  enum: [
                    "ORDER_TRACKING",
                    "CANCELLATION",
                    "RETURN_REFUND",
                    "SHIPPING_INFO",
                    "PAYMENT_COD",
                    "PRODUCT_INFO",
                    "OUT_OF_SCOPE",
                    "OTHER",
                  ],
                },
                order_id: {
                  type: Type.STRING,
                  description: "Canonical order ID like ORD-101, or empty string/null if none",
                },
                resolution_status: {
                  type: Type.STRING,
                  enum: [
                    "RESOLVED",
                    "UNRESOLVED",
                    "ESCALATION_NEEDED",
                    "POLICY_DECLINED",
                  ],
                },
                call_summary: {
                  type: Type.STRING,
                  description: "2-3 sentence factual summary of the call written in English using Latin characters only",
                },
                tools_used: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                tickets_created: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "List of created support ticket IDs, e.g. ['TKT-1001']",
                },
                escalation: {
                  type: Type.BOOLEAN,
                  description: "Whether the call was escalated to human support or a ticket was created",
                },
                customer_sentiment: {
                  type: Type.STRING,
                  enum: ["POSITIVE", "NEUTRAL", "NEGATIVE"],
                },
                follow_up_needed: {
                  type: Type.BOOLEAN,
                },
              },
              required: [
                "customer_intent",
                "resolution_status",
                "call_summary",
                "tools_used",
                "tickets_created",
                "escalation",
                "customer_sentiment",
                "follow_up_needed",
              ],
            },
          },
        });
        break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[Summary API] Model '${model}' failed:`, lastError.message);
      }
    }

    if (!response) {
      throw lastError || new Error("Failed to summarize call via Gemini.");
    }

    const rawText = response.text || "";
    let summary: PostCallSummary;
    try {
      summary = JSON.parse(rawText);
      if (summary.order_id === "null" || summary.order_id === "") {
        summary.order_id = null;
      }
      summary.language = summary.language || language;
      const allTickets = Array.from(
        new Set([...(summary.tickets_created || []), ...createdTicketIds])
      );
      summary.tickets_created = allTickets;
      summary.escalation =
        summary.escalation ||
        allTickets.length > 0 ||
        summary.resolution_status === "ESCALATION_NEEDED";
      // Final pass: ensure every string field is clean Latin script
      summary.call_summary = toDisplayText(summary.call_summary);
    } catch (parseErr) {
      console.error("[Summary API] Failed to parse JSON response:", rawText, parseErr);
      summary = {
        language,
        customer_intent: "OTHER",
        order_id: null,
        resolution_status: createdTicketIds.length > 0 ? "ESCALATION_NEEDED" : "RESOLVED",
        call_summary: "Customer support call completed successfully.",
        tools_used: toolCalls.map((t: { name: string }) => t.name),
        tickets_created: createdTicketIds,
        escalation: createdTicketIds.length > 0,
        customer_sentiment: "NEUTRAL",
        follow_up_needed: createdTicketIds.length > 0,
      };
    }

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[Summary API Error]", err);
    const fallbackSummary: PostCallSummary = {
      language: "en",
      customer_intent: "OTHER",
      order_id: null,
      resolution_status: "RESOLVED",
      call_summary: "Call completed. Summary generation encountered a temporary network issue.",
      tools_used: [],
      tickets_created: [],
      escalation: false,
      customer_sentiment: "NEUTRAL",
      follow_up_needed: false,
    };
    return NextResponse.json({ summary: fallbackSummary });
  }
}
