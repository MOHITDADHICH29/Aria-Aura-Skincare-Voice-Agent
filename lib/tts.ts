import {
  TTS_CHUNK_MIN_CHARS,
  TTS_CHUNK_TARGET_CHARS,
  TTS_CHUNK_MAX_CHARS,
} from "./config";
import { toDisplayText } from "./language";

/**
 * Defensive speakable-text sanitizer:
 * - Converts any Devanagari to Roman Hinglish
 * - Strips markdown, emojis, asterisks, bullets, brackets
 * - Replaces "…", "—", "–", ";" with comma or full stop
 * - Converts "₹699" -> "699 rupees"
 * - Converts order IDs "ORD-101" -> "O R D one zero one"
 * - Converts ticket IDs "TKT-1001" -> "T K T one zero zero one"
 * - Strips accidental prompt or style instructions (e.g. "Say in...", "Speak in...")
 * - Collapses repeated punctuation and whitespace
 */
export function sanitizeForSpeech(rawText: string): string {
  if (!rawText) return "";

  // 1. First ensure Roman transliteration
  let cleaned = toDisplayText(rawText);

  // 2. Strip accidental style-instruction prefixes e.g. "Say in a confident voice: hello"
  cleaned = cleaned.replace(
    /^(say|speak|read|deliver)\s+(in|it|with|as)[^:.\n]{0,80}:\s*/i,
    ""
  );
  cleaned = cleaned.replace(/^aria says?:?\s*/i, "");

  // 3. Currency symbol to words: ₹699 -> 699 rupees, Rs 699 -> 699 rupees
  cleaned = cleaned.replace(/₹\s*(\d+)/g, "$1 rupees");
  cleaned = cleaned.replace(/\bRs\.?\s*(\d+)/gi, "$1 rupees");

  // 4. Order ID spell-out: ORD-101 -> O R D one zero one
  const digitWords: Record<string, string> = {
    "0": "zero",
    "1": "one",
    "2": "two",
    "3": "three",
    "4": "four",
    "5": "five",
    "6": "six",
    "7": "seven",
    "8": "eight",
    "9": "nine",
  };

  cleaned = cleaned.replace(/\bORD-(\d+)\b/gi, (_, digits: string) => {
    const spelledDigits = digits
      .split("")
      .map((d) => digitWords[d] || d)
      .join(" ");
    return `O R D ${spelledDigits}`;
  });

  // Ticket ID spell-out: TKT-1001 -> T K T one zero zero one
  cleaned = cleaned.replace(/\bTKT-(\d+)\b/gi, (_, digits: string) => {
    const spelledDigits = digits
      .split("")
      .map((d) => digitWords[d] || d)
      .join(" ");
    return `T K T ${spelledDigits}`;
  });

  // 5. Replace dashes, ellipses, semicolons with gentle pauses or sentence ends
  cleaned = cleaned.replace(/--+/g, ", ");
  cleaned = cleaned.replace(/[—–]/g, ", ");
  cleaned = cleaned.replace(/\.{3,}/g, ".");
  cleaned = cleaned.replace(/…/g, ".");
  cleaned = cleaned.replace(/;/g, ",");

  // 6. Strip markdown characters, bullets, brackets, code blocks
  cleaned = cleaned.replace(/[*_~`#>]/g, "");
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  cleaned = cleaned.replace(/[\[\]{}()]/g, "");

  // 7. Remove emojis and unusual non-ASCII symbols
  cleaned = cleaned.replace(/[\uD800-\uDFFF]./g, "");

  // 8. Collapse repeated punctuation (e.g. "??", "!!", "...")
  cleaned = cleaned.replace(/\.{2,}/g, ".");
  cleaned = cleaned.replace(/!{2,}/g, "!");
  cleaned = cleaned.replace(/\?{2,}/g, "?");
  cleaned = cleaned.replace(/,{2,}/g, ",");

  // 9. Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

/**
 * Sentence-level chunking:
 * Send the whole reply (up to 400 characters) as ONE /api/tts request.
 * If longer than 400 characters, split at sentence boundaries into at most two chunks
 * of at least 120 characters.
 */
export function chunkTextForSpeech(text: string): string[] {
  const sanitized = sanitizeForSpeech(text);
  if (!sanitized) return [];

  // Up to 400 chars: send as ONE request
  if (sanitized.length <= TTS_CHUNK_MAX_CHARS) {
    return [sanitized];
  }

  // Split on sentence boundaries, keeping punctuation (. ? !)
  const rawParts = sanitized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [sanitized];
  const sentences = rawParts.map((s) => s.trim()).filter((s) => s.length > 0);

  if (sentences.length <= 1) {
    return [sanitized];
  }

  // Find a split point closest to the middle such that chunk1 >= 120 and chunk2 >= 120
  const halfLen = sanitized.length / 2;
  let bestSplitIndex = -1;
  let minDiff = Infinity;

  let currentLen = 0;
  for (let i = 0; i < sentences.length - 1; i++) {
    currentLen += sentences[i].length + 1;
    const remainingLen = sanitized.length - currentLen;
    const satisfiesMin = currentLen >= TTS_CHUNK_MIN_CHARS && remainingLen >= TTS_CHUNK_MIN_CHARS;
    const diff = Math.abs(currentLen - halfLen);

    if (satisfiesMin) {
      if (diff < minDiff) {
        minDiff = diff;
        bestSplitIndex = i;
      }
    }
  }

  // Fallback: if no split satisfied both >= 120, take sentence split closest to middle
  if (bestSplitIndex === -1) {
    currentLen = 0;
    for (let i = 0; i < sentences.length - 1; i++) {
      currentLen += sentences[i].length + 1;
      const diff = Math.abs(currentLen - halfLen);
      if (diff < minDiff) {
        minDiff = diff;
        bestSplitIndex = i;
      }
    }
  }

  if (bestSplitIndex !== -1) {
    const chunk1 = sentences.slice(0, bestSplitIndex + 1).join(" ").trim();
    const chunk2 = sentences.slice(bestSplitIndex + 1).join(" ").trim();
    return [chunk1, chunk2].filter(Boolean);
  }

  return [sanitized];
}
