/**
 * Simplified WAV audio playback via standard HTMLAudioElement with preloading,
 * zero Web Audio modifications/resampling/fades, and strict female-only browser fallback.
 */
import {
  DEFAULT_GEMINI_TTS_VOICE,
  TTS_NETWORK_TIMEOUT_MS,
  USE_BROWSER_TTS_PRIMARY,
} from "./config";
import { sanitizeForSpeech, chunkTextForSpeech } from "./tts";
import { Language } from "./types";

const activeUtterances: SpeechSynthesisUtterance[] = [];
let lockedFallbackVoice: SpeechSynthesisVoice | null = null;
let lockedVoiceLanguage: Language | null = null;

/**
 * Harmless stub for any external callers expecting resumeAudioContext
 */
export async function resumeAudioContext(): Promise<void> {
  return Promise.resolve();
}

/**
 * Voice selection (female only, locked for the whole call):
 * - English mode:
 *     pick an en-IN female voice first (names containing Neerja, Heera, Kalpana, Veena, Lekha, Zira
 *     or any "English (India)" female voice), then any other female English voice.
 *     NEVER use a Hindi (hi-IN) voice for English text.
 * - Hinglish mode:
 *     pick an en-IN female voice too (it reads Roman-script Hinglish much better),
 *     and only use a hi-IN female voice if no en-IN female voice exists.
 * - Never use a male voice. If none is available, show text only.
 */
export function getLockedFemaleVoice(language: Language = "en"): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  if (lockedFallbackVoice && lockedVoiceLanguage === language) {
    return lockedFallbackVoice;
  }

  const voices = window.speechSynthesis.getVoices() || [];
  if (voices.length === 0) {
    return null;
  }

  const maleNames = [
    "ravi", "rishi", "prabhat", "hemant", "kalidas", "david", "mark", "male",
    "george", "james", "richard", "charles", "guy", "stefan", "madhur"
  ];

  const isMale = (v: SpeechSynthesisVoice) => {
    const lower = v.name.toLowerCase();
    return maleNames.some((m) => lower.includes(m));
  };

  const isFemale = (v: SpeechSynthesisVoice) => {
    if (isMale(v)) return false;
    const lower = v.name.toLowerCase();
    const femaleHints = [
      "female", "woman", "neerja", "heera", "veena", "lekha", "kalpana",
      "zira", "samantha", "kavita", "priya", "shruti", "swara"
    ];
    if (femaleHints.some((h) => lower.includes(h))) return true;
    if (lower.includes("india") || lower.includes("in")) return true;
    return true;
  };

  const enInFemalePriorities = ["neerja", "heera", "kalpana", "veena", "lekha", "zira", "samantha"];

  if (language === "en") {
    // English mode:
    // 1. Pick an en-IN female voice first by priority names
    for (const prio of enInFemalePriorities) {
      const match = voices.find(
        (v) =>
          !isMale(v) &&
          (v.lang.toLowerCase() === "en-in" || v.lang.toLowerCase().startsWith("en-in") || v.name.toLowerCase().includes("india")) &&
          v.name.toLowerCase().includes(prio)
      );
      if (match) {
        lockedFallbackVoice = match;
        lockedVoiceLanguage = language;
        return match;
      }
    }

    // 2. Any en-IN female voice (never use hi-IN)
    const anyEnInFemale = voices.find(
      (v) =>
        !isMale(v) &&
        (v.lang.toLowerCase() === "en-in" || v.lang.toLowerCase().startsWith("en-in")) &&
        isFemale(v)
    );
    if (anyEnInFemale) {
      lockedFallbackVoice = anyEnInFemale;
      lockedVoiceLanguage = language;
      return anyEnInFemale;
    }

    // 3. Any other female English voice (e.g. en-US / en-GB)
    const anyOtherEnFemale = voices.find(
      (v) =>
        !isMale(v) &&
        v.lang.toLowerCase().startsWith("en") &&
        isFemale(v)
    );
    if (anyOtherEnFemale) {
      lockedFallbackVoice = anyOtherEnFemale;
      lockedVoiceLanguage = language;
      return anyOtherEnFemale;
    }

    console.warn("[Voice Selection] English mode: No female English voice found, showing text only (never use hi-IN).");
    return null;
  } else {
    // Hinglish mode:
    // 1. Pick an en-IN female voice first (reads Roman Hinglish best)
    for (const prio of enInFemalePriorities) {
      const match = voices.find(
        (v) =>
          !isMale(v) &&
          (v.lang.toLowerCase() === "en-in" || v.lang.toLowerCase().startsWith("en-in") || v.name.toLowerCase().includes("india")) &&
          v.name.toLowerCase().includes(prio)
      );
      if (match) {
        lockedFallbackVoice = match;
        lockedVoiceLanguage = language;
        return match;
      }
    }

    const anyEnInFemale = voices.find(
      (v) =>
        !isMale(v) &&
        (v.lang.toLowerCase() === "en-in" || v.lang.toLowerCase().startsWith("en-in")) &&
        isFemale(v)
    );
    if (anyEnInFemale) {
      lockedFallbackVoice = anyEnInFemale;
      lockedVoiceLanguage = language;
      return anyEnInFemale;
    }

    // 2. hi-IN female voice for Hinglish only
    const anyHiInFemale = voices.find(
      (v) =>
        !isMale(v) &&
        (v.lang.toLowerCase() === "hi-in" || v.lang.toLowerCase().startsWith("hi")) &&
        isFemale(v)
    );
    if (anyHiInFemale) {
      lockedFallbackVoice = anyHiInFemale;
      lockedVoiceLanguage = language;
      return anyHiInFemale;
    }

    // 3. Other female English voice
    const anyOtherEnFemale = voices.find(
      (v) =>
        !isMale(v) &&
        v.lang.toLowerCase().startsWith("en") &&
        isFemale(v)
    );
    if (anyOtherEnFemale) {
      lockedFallbackVoice = anyOtherEnFemale;
      lockedVoiceLanguage = language;
      return anyOtherEnFemale;
    }

    console.warn("[Voice Selection] Hinglish mode: No female voice found, showing text only.");
    return null;
  }
}

export function resetLockedVoice(): void {
  lockedFallbackVoice = null;
  lockedVoiceLanguage = null;
}

/**
 * Speak with browser SpeechSynthesis:
 * - Speak the whole reply as ONE single utterance with rate 1.0 and pitch 1.0.
 * - No per-word or per-sentence splitting.
 * - Reference retained in activeUtterances so V8 doesn't garbage collect mid-speech.
 */
export function speakWithBrowserSpeechSynthesis(
  text: string,
  callbacks: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: unknown) => void;
  },
  onFallbackUsed?: (voiceName: string) => void,
  language: Language = "en"
): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    callbacks.onEnd?.();
    return () => {};
  }

  window.speechSynthesis.cancel();
  activeUtterances.length = 0;

  const clean = sanitizeForSpeech(text);
  if (!clean) {
    callbacks.onEnd?.();
    return () => {};
  }

  const voice = getLockedFemaleVoice(language);
  if (!voice) {
    console.warn("[Voice] Suitable female browser voice unavailable; showing text only.");
    callbacks.onEnd?.();
    return () => {};
  }

  if (onFallbackUsed) {
    onFallbackUsed(voice.name);
  }

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.voice = voice;
  utterance.lang = voice.lang || (language === "hinglish" ? "en-IN" : "en-IN");
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  // Prevent garbage collection
  activeUtterances.push(utterance);

  let hasEnded = false;
  const finish = () => {
    if (hasEnded) return;
    hasEnded = true;
    activeUtterances.length = 0;
    callbacks.onEnd?.();
  };

  utterance.onstart = () => {
    callbacks.onStart?.();
  };

  utterance.onend = () => {
    finish();
  };

  utterance.onerror = (e) => {
    if (e.error === "canceled" || e.error === "interrupted") {
      activeUtterances.length = 0;
      return;
    }
    console.warn("[SpeechSynthesis Error]", e);
    callbacks.onError?.(e);
    finish();
  };

  try {
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error("[SpeechSynthesis Failed]", err);
    finish();
  }

  return () => {
    hasEnded = true;
    activeUtterances.length = 0;
    window.speechSynthesis.cancel();
  };
}

interface FetchWavResult {
  blob: Blob;
  voiceName: string;
  sampleRate: number;
  duration: number;
}

/**
 * Plain, reliable VoicePlayer:
 * - Plays raw 24000Hz 16-bit mono WAV wrapped in a standard 44-byte WAV header via HTMLAudioElement.
 * - Back-to-back chaining with early preloading (`audio.load()`).
 * - Zero Web Audio scheduling, zero sample manipulation, zero silence trimming/clipping.
 * - Detailed diagnostic logging for every reply.
 */
export class VoicePlayer {
  private currentAudio: HTMLAudioElement | null = null;
  private nextAudio: HTMLAudioElement | null = null;
  private activeBlobUrls: string[] = [];
  private abortController: AbortController | null = null;
  private fallbackCancel: (() => void) | null = null;
  private isPlaying = false;

  public async playText(
    text: string,
    callbacks: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: unknown) => void;
    },
    onVoiceSelected?: (voiceName: string) => void,
    language: Language = "en",
    explicitVoice?: string
  ): Promise<() => void> {
    this.stop();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const chunks = chunkTextForSpeech(text);
    if (chunks.length === 0) {
      callbacks.onEnd?.();
      return () => {};
    }

    // Direct browser TTS bypass flag (default false)
    if (USE_BROWSER_TTS_PRIMARY) {
      return this.playFallback(text, "USE_BROWSER_TTS_PRIMARY enabled", callbacks, onVoiceSelected, language);
    }

    // Helper to fetch one chunk WAV with 1 retry (12s timeout each)
    const fetchChunkWav = async (chunkText: string): Promise<FetchWavResult> => {
      let attempts = 0;
      const maxAttempts = 2; // 1 initial attempt + 1 retry
      let lastFailureReason = "unknown";

      while (attempts < maxAttempts) {
        attempts++;
        if (signal.aborted) throw new Error("Playback aborted");

        try {
          const timeoutSignal = AbortSignal.timeout(TTS_NETWORK_TIMEOUT_MS);
          const combinedSignal = AbortSignal.any
            ? AbortSignal.any([signal, timeoutSignal])
            : signal;

          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: chunkText,
              voiceName: explicitVoice || process.env.NEXT_PUBLIC_GEMINI_TTS_VOICE || DEFAULT_GEMINI_TTS_VOICE,
            }),
            signal: combinedSignal,
          });

          if (!res.ok) {
            let errData: any = {};
            try {
              errData = await res.json();
            } catch {}

            const status = res.status;
            if (status === 429 || errData.isQuota) {
              lastFailureReason = `HTTP 429 Quota Exceeded (${errData.error || "Too Many Requests"})`;
              console.warn(`[TTS Client] Attempt ${attempts}: ${lastFailureReason}`);
            } else {
              lastFailureReason = `HTTP ${status}: ${errData.error || res.statusText}`;
              console.warn(`[TTS Client] Attempt ${attempts} failed: ${lastFailureReason}`);
            }

            if (attempts < maxAttempts) {
              // Wait 100ms before retry
              await new Promise((r) => setTimeout(r, 100));
              continue;
            }
            throw new Error(lastFailureReason);
          }

          const voiceHeader = res.headers.get("X-Voice-Name") || explicitVoice || DEFAULT_GEMINI_TTS_VOICE;
          const sampleRateHeader = Number(res.headers.get("X-Sample-Rate")) || 24000;
          const durationHeader = Number(res.headers.get("X-Duration-Seconds")) || 0;

          const blob = await res.blob();
          return {
            blob,
            voiceName: voiceHeader,
            sampleRate: sampleRateHeader,
            duration: durationHeader,
          };
        } catch (err: any) {
          if (signal.aborted) throw err;
          if (err.name === "TimeoutError") {
            lastFailureReason = `Timeout after ${TTS_NETWORK_TIMEOUT_MS}ms`;
          } else if (!lastFailureReason || lastFailureReason === "unknown") {
            lastFailureReason = err.message || "Network request failed";
          }
          console.warn(`[TTS Client] Chunk fetch attempt ${attempts} error:`, lastFailureReason);

          if (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 100));
            continue;
          }
          throw new Error(lastFailureReason);
        }
      }

      throw new Error(lastFailureReason);
    };

    try {
      // 1. Fetch chunk 0
      const chunk0Result = await fetchChunkWav(chunks[0]);
      if (signal.aborted) return () => {};

      const blobUrl0 = URL.createObjectURL(chunk0Result.blob);
      this.activeBlobUrls.push(blobUrl0);

      const audio0 = new Audio(blobUrl0);
      this.currentAudio = audio0;

      // 2. If there is a chunk 1, prefetch concurrently and call load() early
      let chunk1AudioPromise: Promise<HTMLAudioElement | null> = Promise.resolve(null);
      if (chunks.length > 1) {
        chunk1AudioPromise = fetchChunkWav(chunks[1])
          .then((res1) => {
            if (signal.aborted) return null;
            const blobUrl1 = URL.createObjectURL(res1.blob);
            this.activeBlobUrls.push(blobUrl1);
            const audio1 = new Audio(blobUrl1);
            audio1.load(); // Call load early to prevent gap between chunks
            this.nextAudio = audio1;
            return audio1;
          })
          .catch((err) => {
            console.warn("[TTS Client] Prefetch of chunk 1 failed:", err);
            return null;
          });
      }

      // 3. Log playback diagnostics to console (not UI)
      console.log(
        `[Voice Playback Diagnostic] engine: "gemini" | voice: "${chunk0Result.voiceName}" | sampleRate: ${chunk0Result.sampleRate}Hz | duration: ${chunk0Result.duration.toFixed(2)}s | fallbackReason: none`,
        {
          engine: "gemini",
          voice: chunk0Result.voiceName,
          sampleRate: chunk0Result.sampleRate,
          duration: `${chunk0Result.duration.toFixed(2)}s`,
          fallbackReason: "none",
        }
      );

      if (onVoiceSelected) {
        onVoiceSelected(chunk0Result.voiceName);
      }

      // 4. Start playback of chunk 0
      this.isPlaying = true;
      callbacks.onStart?.();

      audio0.onended = async () => {
        URL.revokeObjectURL(blobUrl0);

        if (chunks.length > 1) {
          const preloadedAudio1 = await chunk1AudioPromise;
          if (signal.aborted) return;

          if (preloadedAudio1) {
            this.currentAudio = preloadedAudio1;
            this.nextAudio = null;

            preloadedAudio1.onended = () => {
              this.cleanupBlobUrls();
              this.isPlaying = false;
              callbacks.onEnd?.();
            };

            preloadedAudio1.onerror = (e) => {
              console.warn("[Audio Error on chunk 1]", e);
              this.cleanupBlobUrls();
              this.isPlaying = false;
              callbacks.onEnd?.();
            };

            preloadedAudio1.play().catch((e) => {
              console.warn("[Audio Playback on chunk 1 failed]", e);
              this.cleanupBlobUrls();
              this.isPlaying = false;
              callbacks.onEnd?.();
            });
            return;
          }
        }

        this.cleanupBlobUrls();
        this.isPlaying = false;
        callbacks.onEnd?.();
      };

      audio0.onerror = (e) => {
        console.warn("[Audio Error on chunk 0]", e);
        this.cleanupBlobUrls();
        this.isPlaying = false;
        callbacks.onError?.(e);
      };

      await audio0.play();
      return () => this.stop();
    } catch (err: any) {
      if (signal.aborted) return () => {};
      const fallbackReason = err?.message || "Gemini TTS failed after retry";
      console.warn("[VoicePlayer] Gemini TTS failed, triggering female browser fallback. Reason:", fallbackReason);

      return this.playFallback(text, fallbackReason, callbacks, onVoiceSelected, language);
    }
  }

  private playFallback(
    text: string,
    fallbackReason: string,
    callbacks: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: unknown) => void;
    },
    onVoiceSelected?: (voiceName: string) => void,
    language: Language = "en"
  ): () => void {
    const voice = getLockedFemaleVoice(language);
    if (!voice) {
      console.warn(
        `%c[Voice Playback Diagnostic]`,
        "font-weight: bold; color: #ef4444;",
        {
          engine: "none",
          fallbackReason: `${fallbackReason} (No suitable female browser voice available - text only)`,
          voice: "none",
          sampleRate: 0,
          duration: "0s",
        }
      );
      callbacks.onEnd?.();
      return () => {};
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const estDuration = (wordCount * 0.4).toFixed(1);

    console.log(
      `[Voice Playback Diagnostic] engine: "browser" | voice: "${voice.name}" | sampleRate: 24000Hz (browser default) | duration: ~${estDuration}s | fallbackReason: "${fallbackReason}"`,
      {
        engine: "browser",
        fallbackReason,
        voice: voice.name,
        sampleRate: 24000,
        duration: `~${estDuration}s`,
      }
    );

    this.isPlaying = true;
    this.fallbackCancel = speakWithBrowserSpeechSynthesis(
      text,
      {
        onStart: () => {
          this.isPlaying = true;
          callbacks.onStart?.();
        },
        onEnd: () => {
          this.isPlaying = false;
          callbacks.onEnd?.();
        },
        onError: (err) => {
          this.isPlaying = false;
          callbacks.onError?.(err);
        },
      },
      onVoiceSelected,
      language
    );

    return () => this.stop();
  }

  private cleanupBlobUrls(): void {
    for (const url of this.activeBlobUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.activeBlobUrls = [];
  }

  public stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }

    if (this.nextAudio) {
      try {
        this.nextAudio.pause();
        this.nextAudio.currentTime = 0;
      } catch {}
      this.nextAudio = null;
    }

    this.cleanupBlobUrls();
    this.isPlaying = false;

    if (this.fallbackCancel) {
      this.fallbackCancel();
      this.fallbackCancel = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      activeUtterances.length = 0;
    }
  }
}
