export type CallState =
  | "Idle"
  | "Greeting"
  | "LanguageChoice"
  | "Listening"
  | "Thinking"
  | "Speaking"
  | "Ended";

export type Language = "en" | "hinglish";
export type LanguageChoiceResult = "en" | "hinglish" | "unknown";

export interface MockOrder {
  order_id: string;
  customer_name: string;
  product: string;
  value: number;
  status: "Processing" | "Out for Delivery" | "Delivered" | "Cancelled";
  tracking: string;
  days_since_delivery: number | null;
  notes: string;
}

export interface ComputedOrderDetails {
  found: boolean;
  order_id?: string;
  customer_name?: string;
  product?: string;
  value?: number;
  status?: string;
  tracking?: string;
  notes?: string;
  can_cancel?: boolean;
  return_eligible?: boolean;
  days_since_delivery?: number | null;
  return_note?: string;
  cod_available?: boolean;
  shipping_fee_applies?: boolean;
  error?: "ORDER_NOT_FOUND" | "MISSING_ORDER_ID";
}

export interface CancelOrderResult {
  success: boolean;
  order_id?: string;
  reason?: string;
  status?: string;
  error?: string;
}

export interface SupportTicket {
  ticket_id: string;
  issue_summary: string;
  order_id?: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  created_at: string;
  eta: string;
  status: "OPEN" | "RESOLVED";
}

export interface TranscriptItem {
  id: string;
  speaker: "Customer" | "Aria";
  text: string;
  timestamp: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
  }>;
}

export interface PostCallSummary {
  customer_intent: string;
  order_id: string | null;
  resolution_status: "RESOLVED" | "UNRESOLVED" | "ESCALATION_NEEDED" | "PARTIAL";
  call_summary: string;
  tools_used: string[];
  customer_sentiment: "POSITIVE" | "NEUTRAL" | "FRUSTRATED" | "NEGATIVE";
  follow_up_needed: boolean;
  language: Language;
  tickets_created: string[];
  escalation: boolean;
}

export interface TimingDiagnostics {
  speechEndToFinalTranscriptMs: number;
  llmFirstTokenMs: number;
  ttsFirstAudioMs: number;
  totalTurnMs: number;
}
