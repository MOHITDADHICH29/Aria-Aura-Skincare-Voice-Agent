import {
  MockOrder,
  ComputedOrderDetails,
  CancelOrderResult,
} from "./types";
import {
  canCancelOrder,
  isReturnEligible,
  computeReturnNote,
  isCodAvailable,
  doesShippingFeeApply,
} from "./policy";

export const INITIAL_ORDERS: MockOrder[] = [
  {
    order_id: "ORD-101",
    customer_name: "Priya Sharma",
    product: "Vitamin C Serum (30ml)",
    value: 699,
    status: "Out for Delivery",
    tracking: "BlueDart BD-982103",
    days_since_delivery: null,
    notes: "Expected delivery by 6 PM today",
  },
  {
    order_id: "ORD-102",
    customer_name: "Rahul Verma",
    product: "Hydrating Sunscreen SPF 50",
    value: 499,
    status: "Delivered",
    tracking: "Delhivery DL-441029",
    days_since_delivery: 14,
    notes: "Delivered 14 days ago. Exceeds the 7-day return policy.",
  },
  {
    order_id: "ORD-103",
    customer_name: "Ananya Patel",
    product: "Green Tea Face Wash + Toner",
    value: 850,
    status: "Processing",
    tracking: "Pending dispatch",
    days_since_delivery: null,
    notes: "Ordered 3 hours ago. Currently processing in warehouse, eligible for cancellation.",
  },
];

// In-memory store
let currentOrders: MockOrder[] = JSON.parse(JSON.stringify(INITIAL_ORDERS));

export function resetOrders(): void {
  currentOrders = JSON.parse(JSON.stringify(INITIAL_ORDERS));
}

export function getAllOrders(): MockOrder[] {
  return [...currentOrders];
}

/**
 * Normalises messy spoken order IDs from Web Speech API into canonical ORD-XXX.
 * Handles spoken digits, words like 'one zero one', 'oh', 'one hundred and one', etc.
 */
export function normalizeOrderId(rawId?: string | null): string {
  if (!rawId || typeof rawId !== "string") return "";

  let cleaned = rawId.toLowerCase().trim();

  // Map spoken number words to digits
  const numberWordMap: Record<string, string> = {
    zero: "0",
    oh: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
  };

  for (const [word, digit] of Object.entries(numberWordMap)) {
    const reg = new RegExp(`\\b${word}\\b`, "gi");
    cleaned = cleaned.replace(reg, digit);
  }

  // Remove spaces, punctuation, dashes
  cleaned = cleaned.replace(/[^a-z0-9]/g, "");

  // Match 3 or more digits (e.g. 101, 102, 103)
  const numMatch = cleaned.match(/\d{3,}/);
  if (numMatch) {
    return `ORD-${numMatch[0]}`;
  }

  if (cleaned.startsWith("ord")) {
    const digits = cleaned.replace("ord", "");
    if (digits) return `ORD-${digits}`;
  }

  const justDigits = cleaned.replace(/\D/g, "");
  if (justDigits.length > 0) {
    return `ORD-${justDigits}`;
  }

  return rawId.trim().toUpperCase();
}

/**
 * Look up order and compute all deterministic policy flags.
 */
export function getOrderDetails(rawId: string): ComputedOrderDetails {
  if (!rawId || rawId.trim().length === 0) {
    return { found: false, error: "MISSING_ORDER_ID" };
  }

  const normalizedId = normalizeOrderId(rawId);
  const order = currentOrders.find(
    (o) => o.order_id.toLowerCase() === normalizedId.toLowerCase()
  );

  if (!order) {
    return { found: false, error: "ORDER_NOT_FOUND" };
  }

  const canCancel = canCancelOrder(order.status);
  const returnEligible = isReturnEligible(order.status, order.days_since_delivery);
  const returnNote = computeReturnNote(order.status, order.days_since_delivery);
  const codAvailable = isCodAvailable(order.value);
  const shippingFeeApplies = doesShippingFeeApply(order.value);

  return {
    found: true,
    order_id: order.order_id,
    customer_name: order.customer_name,
    product: order.product,
    value: order.value,
    status: order.status,
    tracking: order.tracking,
    notes: order.notes,
    can_cancel: canCancel,
    return_eligible: returnEligible,
    days_since_delivery: order.days_since_delivery,
    return_note: returnNote,
    cod_available: codAvailable,
    shipping_fee_applies: shippingFeeApplies,
  };
}

/**
 * Cancel order if status is Processing.
 */
export function cancelOrder(rawId: string): CancelOrderResult {
  if (!rawId || rawId.trim().length === 0) {
    return { success: false, error: "MISSING_ORDER_ID", reason: "No order ID was provided." };
  }

  const normalizedId = normalizeOrderId(rawId);
  const orderIndex = currentOrders.findIndex(
    (o) => o.order_id.toLowerCase() === normalizedId.toLowerCase()
  );

  if (orderIndex === -1) {
    return {
      success: false,
      error: "ORDER_NOT_FOUND",
      reason: `Could not locate an order with ID ${normalizedId}.`,
    };
  }

  const order = currentOrders[orderIndex];

  if (!canCancelOrder(order.status)) {
    let explanation = `Order ${order.order_id} cannot be cancelled because it is already ${order.status}.`;
    if (order.status === "Out for Delivery" || order.status === "Delivered") {
      explanation += " Once dispatched, orders cannot be cancelled online. If you no longer want the item, you may refuse delivery at the doorstep.";
    }
    return {
      success: false,
      order_id: order.order_id,
      status: order.status,
      reason: explanation,
    };
  }

  order.status = "Cancelled";
  order.notes = "Cancelled by customer via voice support.";

  return {
    success: true,
    order_id: order.order_id,
    status: "Cancelled",
    reason: `Order ${order.order_id} has been successfully cancelled. A confirmation SMS will be sent shortly.`,
  };
}
