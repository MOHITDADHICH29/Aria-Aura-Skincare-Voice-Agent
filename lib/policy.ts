import { MockOrder } from "./types";

/**
 * Pure policy rules for Aura Skincare e-commerce operations.
 * Keeping policy calculation pure and deterministic ensures the LLM never hallucinates date arithmetic or eligibility.
 */

export const RETURN_WINDOW_DAYS = 7;
export const MAX_COD_ORDER_VALUE = 2500;
export const FREE_SHIPPING_THRESHOLD = 499;

/**
 * Checks whether an order is eligible for customer cancellation.
 * Only orders in "Processing" status can be cancelled online.
 */
export function canCancelOrder(status: MockOrder["status"]): boolean {
  return status === "Processing";
}

/**
 * Checks whether an order is eligible for return.
 * Only "Delivered" orders delivered within the 7-day return window are eligible.
 */
export function isReturnEligible(
  status: MockOrder["status"],
  daysSinceDelivery: number | null
): boolean {
  if (status !== "Delivered") return false;
  if (daysSinceDelivery === null || daysSinceDelivery === undefined) return false;
  return daysSinceDelivery <= RETURN_WINDOW_DAYS;
}

/**
 * Returns a human-friendly policy explanation note for returns.
 */
export function computeReturnNote(
  status: MockOrder["status"],
  daysSinceDelivery: number | null
): string {
  if (status !== "Delivered") {
    return "Not delivered yet; returns apply within 7 days of delivery for unopened items.";
  }

  if (daysSinceDelivery !== null && daysSinceDelivery <= RETURN_WINDOW_DAYS) {
    return `Delivered ${daysSinceDelivery} day(s) ago. Eligible for return within the 7-day return window for unopened products.`;
  }

  return `Delivered ${daysSinceDelivery ?? "more than 7"} days ago. Ineligible for return as the 7-day return window has passed.`;
}

/**
 * Determines Cash on Delivery (COD) availability based on cart/order value.
 */
export function isCodAvailable(orderValue: number): boolean {
  return orderValue <= MAX_COD_ORDER_VALUE;
}

/**
 * Determines whether shipping fee applies (< ₹499 incurs standard shipping).
 */
export function doesShippingFeeApply(orderValue: number): boolean {
  return orderValue < FREE_SHIPPING_THRESHOLD;
}
