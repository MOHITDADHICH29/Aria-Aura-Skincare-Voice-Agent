import { Type } from "@google/genai";

export const geminiToolDeclarations: any = [
  {
    functionDeclarations: [
      {
        name: "get_order_details",
        description:
          "Fetches real-time status, tracking information, and return/cancellation policy flags for an Aura Skincare order by order ID.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            order_id: {
              type: Type.STRING,
              description: "The order ID to look up, e.g. ORD-101, ORD-102, ORD-103.",
            },
          },
          required: ["order_id"],
        },
      },
      {
        name: "cancel_order",
        description:
          "Cancel an order that is currently in Processing status. MUST ONLY be invoked after explicit confirmation from the customer.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            order_id: {
              type: Type.STRING,
              description: "The order ID to cancel, e.g. ORD-103.",
            },
          },
          required: ["order_id"],
        },
      },
      {
        name: "create_support_ticket",
        description:
          "Create an escalated support ticket for human representative review. Use ONLY when the customer asks for a human, reports damaged/defective products, or has an out-of-scope issue that policy cannot resolve.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            issue_summary: {
              type: Type.STRING,
              description: "A clear, concise summary of the customer's problem or escalation reason.",
            },
            order_id: {
              type: Type.STRING,
              description: "Optional order ID related to the issue, e.g. ORD-101.",
            },
            priority: {
              type: Type.STRING,
              enum: ["LOW", "MEDIUM", "HIGH"],
              description: "Priority of the ticket based on customer sentiment and urgency.",
            },
          },
          required: ["issue_summary"],
        },
      },
    ],
  },
];
