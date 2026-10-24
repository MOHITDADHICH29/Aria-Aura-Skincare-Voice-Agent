import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { SUMMARY_SYSTEM_PROMPT } from "@/lib/prompt";

export interface CallSummary {
  customer_intent:
    | "ORDER_TRACKING"
    | "CANCELLATION"
    | "RETURN_REFUND"
    | "SHIPPING_INFO"
    | "PAYMENT_COD"
    | "PRODUCT_INFO"
    | "OUT_OF_SCOPE"
    | "OTHER";
  order_id: string | null;
  resolution_status:
    | "RESOLVED"
    | "UNRESOLVED"
    | "ESCALATION_NEEDED"
    | "POLICY_DECLINED";
  call_summary: string;
  tools_used: string[];
  customer_sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  follow_up_needed: boolean;
}

const FALLBACK_MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-flash-lite-latest",
  "gemini-3.6-flash",
];

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const body = await req.json().catch(() => ({}));
    const transcript = body.transcript || [];
    const toolCalls = body.toolCalls || [];

    if (!transcript || transcript.length === 0) {
      const emptySummary: CallSummary = {
        customer_intent: "OTHER",
        order_id: null,
        resolution_status: "RESOLVED",
        call_summary: "Call connected and ended without customer speech.",
        tools_used: [],
        customer_sentiment: "NEUTRAL",
        follow_up_needed: false,
      };
      return NextResponse.json({ summary: emptySummary });
    }

    if (!apiKey) {
      console.warn("[Summary API] Missing GEMINI_API_KEY");
      const mockSummary: CallSummary = {
        customer_intent: "OTHER",
        order_id: null,
        resolution_status: "RESOLVED",
        call_summary: "Summary generated in mock mode due to unconfigured API key.",
        tools_used: toolCalls.map((t: { name: string }) => t.name),
        customer_sentiment: "NEUTRAL",
        follow_up_needed: false,
      };
      return NextResponse.json({ summary: mockSummary });
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelsToTry = Array.from(new Set(FALLBACK_MODELS));

    const promptText = `
Please analyze this customer support call transcript and tool executions for Aura Skincare:

TRANSCRIPT:
${transcript
  .map(
    (t: { speaker: string; text: string; timestamp?: string }) =>
      `[${t.timestamp || "Time"}] ${t.speaker}: ${t.text}`
  )
  .join("\n")}

TOOL INVOCATIONS:
${JSON.stringify(toolCalls, null, 2)}

Produce a valid JSON object matching the requested schema with factual accuracy.
`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                  description: "Canonical order ID like ORD-101, or string 'null' or empty if none",
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
                  description: "2-3 sentence factual summary of the call",
                },
                tools_used: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
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
    let summary: CallSummary;
    try {
      summary = JSON.parse(rawText);
      // Clean order_id if it's literal string "null" or empty
      if (summary.order_id === "null" || summary.order_id === "") {
        summary.order_id = null;
      }
    } catch (parseErr) {
      console.error("[Summary API] Failed to parse JSON response:", rawText, parseErr);
      summary = {
        customer_intent: "OTHER",
        order_id: null,
        resolution_status: "RESOLVED",
        call_summary: "Customer support call completed successfully.",
        tools_used: toolCalls.map((t: { name: string }) => t.name),
        customer_sentiment: "NEUTRAL",
        follow_up_needed: false,
      };
    }

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[Summary API Error]", err);
    // Graceful fallback so client UI never crashes
    const fallbackSummary: CallSummary = {
      customer_intent: "OTHER",
      order_id: null,
      resolution_status: "RESOLVED",
      call_summary: "Call completed. Summary generation encountered a temporary network issue.",
      tools_used: [],
      customer_sentiment: "NEUTRAL",
      follow_up_needed: false,
    };
    return NextResponse.json({ summary: fallbackSummary });
  }
}
