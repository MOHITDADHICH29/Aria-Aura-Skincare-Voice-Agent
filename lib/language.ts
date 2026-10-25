import { Language, LanguageChoiceResult } from "./types";

/**
 * Phonetic Devanagari to clean Roman Hinglish transliteration table.
 * Produces clean, readable Roman Hindi (e.g. "mera order kahan hai") without academic diacritics.
 */
const VOWELS: Record<string, string> = {
  "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo",
  "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
  "ा": "a", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo",
  "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
};

const CONSONANTS: Record<string, string> = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "व": "v",
  "श": "sh", "ष": "sh", "स": "s", "ह": "h",
  "क्ष": "ksh", "त्र": "tr", "ज्ञ": "gy",
  "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "ड़": "d", "ढ़": "dh", "फ़": "f"
};

const MODIFIERS: Record<string, string> = {
  "ं": "n", "ँ": "n", "ः": "h", "्": ""
};

/**
 * Pure function: transliterates Devanagari characters into natural Roman Hinglish.
 */
export function devanagariToRoman(text: string): string {
  if (!text) return "";
  let result = "";
  const chars = Array.from(text);

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const code = ch.charCodeAt(0);

    // If outside Devanagari Unicode range, retain character
    if (code < 0x0900 || code > 0x097f) {
      result += ch;
      continue;
    }

    if (MODIFIERS[ch] !== undefined) {
      result += MODIFIERS[ch];
      continue;
    }

    if (VOWELS[ch] !== undefined) {
      result += VOWELS[ch];
      continue;
    }

    if (CONSONANTS[ch] !== undefined) {
      const base = CONSONANTS[ch];
      const next = chars[i + 1];
      // If followed by virama (halant), do not add implicit 'a'
      if (next === "्") {
        result += base;
      }
      // If followed by vowel sign (matra)
      else if (next && VOWELS[next] !== undefined) {
        result += base;
      }
      // Otherwise in Hindi word final consonant typically drops implicit 'a', medial has 'a'
      else if (i + 1 < chars.length && chars[i + 1] !== " " && chars[i + 1] !== "\n") {
        result += base + "a";
      } else {
        result += base;
      }
      continue;
    }

    // Default fallback: omit unrecognized Devanagari mark
  }

  // Clean common word artifacts if Devanagari was converted
  return result
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * toDisplayText(text):
 * (a) converts any Devanagari into clean, readable Roman Hinglish
 * (b) strips any leftover non-Latin characters (except standard punctuation, digits, currency symbols)
 * (c) leaves digits, ₹ and IDs like ORD-101 intact
 */
export function toDisplayText(text?: string | null): string {
  if (!text) return "";

  // 1. Transliterate Devanagari to Roman
  let converted = devanagariToRoman(text);

  // 2. Strip any leftover non-Latin characters, keeping standard English characters, digits, ₹ and punctuation
  converted = converted.replace(/[^\w\s.,!?'"₹\-$%&():;/]/g, " ");

  // 3. Normalize multiple whitespace
  return converted.replace(/\s+/g, " ").trim();
}

/**
 * Dev-only assertion to guarantee that no Devanagari character ever leaks to the UI render layer.
 */
export function assertNoDevanagari(text: string, context = "render"): void {
  if (process.env.NODE_ENV !== "production") {
    const devanagariRegex = /[\u0900-\u097F]/;
    if (devanagariRegex.test(text)) {
      console.error(
        `[ASSERTION FAILED] Devanagari character detected in ${context}: "${text}"`
      );
    }
  }
}

/**
 * Keyword-based language choice detector (Pure function).
 * Matches inside full sentences without an LLM call.
 * Raw Devanagari is checked here ONLY for matching; it is never rendered.
 */
export function detectLanguageChoice(transcript: string): LanguageChoiceResult {
  if (!transcript || typeof transcript !== "string") {
    return "unknown";
  }

  const lower = transcript.toLowerCase().trim();

  // Keyword definitions
  const englishKeywords = [
    "english",
    "angrezi",
    "inglish",
    "इंग्लिश",
    "अंग्रेज़ी",
    "अंग्रेजी",
    "eng",
  ];

  const hinglishKeywords = [
    "hinglish",
    "hindi",
    "hing lish",
    "हिंग्लिश",
    "हिन्दी",
    "हिंदी",
    "mix",
    "hindi mein",
    "hinglish mein",
  ];

  const hasEnglish = englishKeywords.some((kw) => {
    const reg = new RegExp(`(^|\\b|\\s)${kw}(\\b|\\s|$)`, "i");
    return reg.test(lower);
  });

  const hasHinglish = hinglishKeywords.some((kw) => {
    const reg = new RegExp(`(^|\\b|\\s)${kw}(\\b|\\s|$)`, "i");
    return reg.test(lower);
  });

  if (hasEnglish && hasHinglish) {
    return "unknown";
  }
  if (hasHinglish) {
    return "hinglish";
  }
  if (hasEnglish) {
    return "en";
  }

  return "unknown";
}

/**
 * Infers language if the customer skips the initial question and states an order request directly.
 * Common Hindi/Hinglish indicators or Devanagari -> hinglish, otherwise en.
 */
export function inferLanguageFromMessage(text: string): Language {
  if (!text) return "en";

  // Check for Devanagari
  if (/[\u0900-\u097F]/.test(text)) {
    return "hinglish";
  }

  // Common Hindi / Hinglish trigger words in Roman script
  const hindiWords = [
    "mera", "meri", "mere", "kahan", "hai", "kya", "chahiye", "kar", "karo", "nahi",
    "batao", "madad", "kab", "aayega", "pahunch", "rokna", "wapas", "bolo", "hoga"
  ];

  const lower = text.toLowerCase();
  for (const word of hindiWords) {
    const reg = new RegExp(`\\b${word}\\b`, "i");
    if (reg.test(lower)) {
      return "hinglish";
    }
  }

  return "en";
}
