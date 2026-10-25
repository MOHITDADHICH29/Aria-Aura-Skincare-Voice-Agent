import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizeOrderId, getOrderDetails, resetOrders, cancelOrder } from "../lib/orders";
import { canCancelOrder, isReturnEligible, computeReturnNote, isCodAvailable, doesShippingFeeApply } from "../lib/policy";
import { detectLanguageChoice, toDisplayText, inferLanguageFromMessage, assertNoDevanagari } from "../lib/language";
import { sanitizeForSpeech, chunkTextForSpeech } from "../lib/tts";

describe("Order ID Normalization", () => {
  test("normalizes exact ORD-101", () => {
    assert.equal(normalizeOrderId("ORD-101"), "ORD-101");
  });

  test("normalizes lowercase with spaces: ord 101", () => {
    assert.equal(normalizeOrderId("ord 101"), "ORD-101");
  });

  test("normalizes spoken number words: o r d one zero one", () => {
    assert.equal(normalizeOrderId("o r d one zero one"), "ORD-101");
  });

  test("normalizes spoken word number: order one zero two", () => {
    assert.equal(normalizeOrderId("order one zero two"), "ORD-102");
  });

  test("normalizes standalone digits: 103", () => {
    assert.equal(normalizeOrderId("103"), "ORD-103");
  });

  test("handles empty and undefined inputs safely", () => {
    assert.equal(normalizeOrderId(""), "");
    assert.equal(normalizeOrderId(null), "");
    assert.equal(normalizeOrderId(undefined), "");
  });
});

describe("Deterministic Policy Logic", () => {
  test("cancellation eligibility: only Processing can be cancelled", () => {
    assert.equal(canCancelOrder("Processing"), true);
    assert.equal(canCancelOrder("Out for Delivery"), false);
    assert.equal(canCancelOrder("Delivered"), false);
    assert.equal(canCancelOrder("Cancelled"), false);
  });

  test("return eligibility: delivered within 7 days", () => {
    // Edge case: exactly 7 days
    assert.equal(isReturnEligible("Delivered", 7), true);
    // 0 days (delivered today)
    assert.equal(isReturnEligible("Delivered", 0), true);
    // 8 days -> expired
    assert.equal(isReturnEligible("Delivered", 8), false);
    // 14 days -> expired
    assert.equal(isReturnEligible("Delivered", 14), false);
    // Not delivered status
    assert.equal(isReturnEligible("Out for Delivery", null), false);
    assert.equal(isReturnEligible("Processing", null), false);
  });

  test("return notes formatting", () => {
    const note7 = computeReturnNote("Delivered", 7);
    assert.match(note7, /Eligible for return/);

    const note14 = computeReturnNote("Delivered", 14);
    assert.match(note14, /Ineligible for return/);

    const notePending = computeReturnNote("Out for Delivery", null);
    assert.match(notePending, /Not delivered yet/);
  });

  test("COD limit (<= ₹2500) and shipping fee threshold (< ₹499)", () => {
    assert.equal(isCodAvailable(699), true);
    assert.equal(isCodAvailable(2500), true);
    assert.equal(isCodAvailable(2501), false);

    assert.equal(doesShippingFeeApply(498), true);
    assert.equal(doesShippingFeeApply(499), false);
    assert.equal(doesShippingFeeApply(699), false);
  });
});

describe("Order Lookup and In-Memory Store", () => {
  test("looks up ORD-101 (Out for Delivery)", () => {
    resetOrders();
    const order = getOrderDetails("ORD-101");
    assert.equal(order.found, true);
    assert.equal(order.status, "Out for Delivery");
    assert.equal(order.can_cancel, false);
    assert.equal(order.return_eligible, false);
  });

  test("looks up ORD-102 (Delivered 14d ago -> return ineligible)", () => {
    resetOrders();
    const order = getOrderDetails("ORD-102");
    assert.equal(order.found, true);
    assert.equal(order.status, "Delivered");
    assert.equal(order.days_since_delivery, 14);
    assert.equal(order.return_eligible, false);
  });

  test("looks up ORD-103 (Processing -> cancel eligible)", () => {
    resetOrders();
    const order = getOrderDetails("ORD-103");
    assert.equal(order.found, true);
    assert.equal(order.status, "Processing");
    assert.equal(order.can_cancel, true);
  });

  test("handles unknown order ID ORD-999 and empty ID", () => {
    const unknown = getOrderDetails("ORD-999");
    assert.equal(unknown.found, false);
    assert.equal(unknown.error, "ORDER_NOT_FOUND");

    const empty = getOrderDetails("");
    assert.equal(empty.found, false);
    assert.equal(empty.error, "MISSING_ORDER_ID");
  });

  test("cancelling order: succeeds on ORD-103, declines on ORD-101", () => {
    resetOrders();
    // Cannot cancel Out for Delivery
    const cancel101 = cancelOrder("ORD-101");
    assert.equal(cancel101.success, false);
    assert.match(cancel101.reason!, /cannot be cancelled/);

    // Can cancel Processing
    const cancel103 = cancelOrder("ORD-103");
    assert.equal(cancel103.success, true);
    assert.equal(cancel103.status, "Cancelled");

    // Second cancel on cancelled order should fail
    const cancel103Again = cancelOrder("ORD-103");
    assert.equal(cancel103Again.success, false);
  });
});

describe("Language Choice Detection and Devanagari Elimination", () => {
  test("detects English keywords", () => {
    assert.equal(detectLanguageChoice("english please"), "en");
    assert.equal(detectLanguageChoice("I prefer English"), "en");
    assert.equal(detectLanguageChoice("angrezi"), "en");
    assert.equal(detectLanguageChoice("eng"), "en");
  });

  test("detects Hinglish keywords", () => {
    assert.equal(detectLanguageChoice("hinglish"), "hinglish");
    assert.equal(detectLanguageChoice("hindi mein bolo"), "hinglish");
    assert.equal(detectLanguageChoice("let's do mix"), "hinglish");
    assert.equal(detectLanguageChoice("hindi"), "hinglish");
  });

  test("returns unknown if both or neither match", () => {
    assert.equal(detectLanguageChoice("both english and hindi"), "unknown");
    assert.equal(detectLanguageChoice("something totally random"), "unknown");
    assert.equal(detectLanguageChoice(""), "unknown");
  });

  test("infers language when order request stated instead of choosing", () => {
    assert.equal(inferLanguageFromMessage("Where is my order ORD-101?"), "en");
    assert.equal(inferLanguageFromMessage("Mera order ORD-101 kahan hai?"), "hinglish");
  });

  test("toDisplayText converts Devanagari to clean Roman Hindi", () => {
    const input1 = "मेरा ऑर्डर कहाँ है";
    const res1 = toDisplayText(input1);
    // Must NOT contain any Devanagari
    assert.equal(/[\u0900-\u097F]/.test(res1), false);
    assert.match(res1.toLowerCase(), /mera/);

    const input2 = "मुझे मेरे प्रोडक्ट के अंदर कुछ डिफेक्ट मिला है";
    const res2 = toDisplayText(input2);
    assert.equal(/[\u0900-\u097F]/.test(res2), false);

    // Verifies assertNoDevanagari does not throw for clean text
    assert.doesNotThrow(() => assertNoDevanagari(res1));
    assert.doesNotThrow(() => assertNoDevanagari(res2));
  });

  test("toDisplayText preserves digits, currency and order IDs", () => {
    const input = "Order ORD-101 costs ₹699 and 50 paise";
    const res = toDisplayText(input);
    assert.equal(res, "Order ORD-101 costs ₹699 and 50 paise");
  });
});

describe("Speakable Text Sanitizer and Chunking", () => {
  test("sanitizes order IDs to spellable spoken form", () => {
    const res = sanitizeForSpeech("Your order ORD-101 has arrived");
    assert.match(res, /O R D one zero one/);
  });

  test("sanitizes currency symbol ₹ to rupees", () => {
    const res = sanitizeForSpeech("The total is ₹699 today");
    assert.match(res, /699 rupees/);
  });

  test("sanitizes ticket ID to spellable spoken form", () => {
    const res = sanitizeForSpeech("Support ticket TKT-1001 created");
    assert.match(res, /T K T one zero zero one/);
  });

  test("strips accidental style instruction prefixes", () => {
    const res1 = sanitizeForSpeech("Say in a calm, confident voice: Your order is on the way.");
    assert.equal(res1, "Your order is on the way.");

    const res2 = sanitizeForSpeech("Speak in Hinglish: Aapka order ready hai.");
    assert.equal(res2, "Aapka order ready hai.");

    const res3 = sanitizeForSpeech("Aria says: Hello there.");
    assert.equal(res3, "Hello there.");
  });

  test("chunkTextForSpeech sentence splitting and merging", () => {
    const shortText = "Your order is out for delivery. It will reach by 6 PM.";
    const chunks = chunkTextForSpeech(shortText);
    assert.ok(chunks.length >= 1 && chunks.length <= 2);
    // Chunks should not be tiny fragments
    for (const c of chunks) {
      assert.ok(c.length >= 25);
    }
  });
});
