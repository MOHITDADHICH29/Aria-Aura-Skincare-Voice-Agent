import { Type } from "@google/genai";
import { getOrderDetails, cancelOrder } from "./orders";

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

/**
 * Gemini tool definitions using @google/genai Type schema
 */
export const geminiToolDeclarations = [
  {
    functionDeclarations: [
      {
        name: "get_order_details",
        description:
          "Fetches real-time status, tracking info, and deterministic return/cancellation policy flags for an Aura Skincare order.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            order_id: {
              type: Type.STRING,
              description:
                "The order ID provided by the customer, e.g. 'ORD-101', 'ord 101', '101', or spoken numbers.",
            },
          },
          required: ["order_id"],
        },
      },
      {
        name: "cancel_order",
        description:
          "Cancels an Aura Skincare order if and only if its status is Processing. Agent MUST ask the customer for explicit confirmation before calling this tool.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            order_id: {
              type: Type.STRING,
              description:
                "The order identifier to cancel (e.g. 'ORD-103').",
            },
          },
          required: ["order_id"],
        },
      },
    ],
  },
];

/**
 * Server-side execution of registered tools.
 */
export function executeTool(name: string, args: Record<string, unknown>): unknown {
  console.log(`[Tool Execution] Executing tool '${name}' with args:`, JSON.stringify(args));

  if (name === "get_order_details") {
    const orderId = String(args?.order_id || "");
    const result = getOrderDetails(orderId);
    console.log(`[Tool Execution] Result for '${name}':`, JSON.stringify(result));
    return result;
  }

  if (name === "cancel_order") {
    const orderId = String(args?.order_id || "");
    const result = cancelOrder(orderId);
    console.log(`[Tool Execution] Result for '${name}':`, JSON.stringify(result));
    return result;
  }

  return { error: `Unknown tool name: ${name}` };
}
