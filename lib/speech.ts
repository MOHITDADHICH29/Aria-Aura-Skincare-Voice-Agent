/**
 * Speech synthesis helper for browser text-to-speech
 */

export function getIndianVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Exact "en-IN"
  const enIN = voices.find((v) => v.lang.toLowerCase() === "en-in" || v.lang.replace("_", "-").toLowerCase() === "en-in");
  if (enIN) return enIN;

  // 2. Starts with "en-IN"
  const enINPrefix = voices.find((v) => v.lang.toLowerCase().startsWith("en-in"));
  if (enINPrefix) return enINPrefix;

  // 3. Indian Hindi voice (hi-IN)
  const hiIN = voices.find((v) => v.lang.toLowerCase().startsWith("hi-in") || v.lang.toLowerCase() === "hi");
  if (hiIN) return hiIN;

  // 4. Any English voice
  const anyEnglish = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
  if (anyEnglish) return anyEnglish;

  // 5. Default
  return voices[0] || null;
}

/**
 * Split reply text into speakable sentence chunks for low latency audio playback.
 */
export function splitIntoSentences(text: string): string[] {
  if (!text) return [];
  // Split on sentence boundaries (. ! ? or newline)
  const rawSentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  return rawSentences
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Speaks sentences in sequence.
 * Calls onStart on first utterance, onEnd on final utterance completion.
 * Returns a cancel function.
 */
export function speakSentences(
  sentences: string[],
  callbacks: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: unknown) => void;
  }
): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    callbacks.onEnd?.();
    return () => {};
  }

  window.speechSynthesis.cancel();

  if (sentences.length === 0) {
    callbacks.onEnd?.();
    return () => {};
  }

  const voice = getIndianVoice();
  let cancelled = false;
  let currentIndex = 0;

  callbacks.onStart?.();

  function speakNext() {
    if (cancelled || currentIndex >= sentences.length) {
      if (!cancelled) callbacks.onEnd?.();
      return;
    }

    const textChunk = sentences[currentIndex];
    const utterance = new SpeechSynthesisUtterance(textChunk);

    if (voice) {
      utterance.voice = voice;
    }
    utterance.lang = voice?.lang || "en-IN";
    // Slightly raised rate ~1.05 as specified in requirements
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      currentIndex++;
      speakNext();
    };

    utterance.onerror = (e) => {
      // If cancelled, error is expected
      if (e.error === "canceled" || e.error === "interrupted") {
        return;
      }
      console.warn("[SpeechSynthesis Error]", e);
      currentIndex++;
      speakNext();
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("[SpeechSynthesis Exception]", e);
      callbacks.onEnd?.();
    }
  }

  speakNext();

  return () => {
    cancelled = true;
    window.speechSynthesis.cancel();
  };
}
