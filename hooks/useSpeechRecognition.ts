"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  RECOGNITION_LANG_ENGLISH,
  RECOGNITION_LANG_HINGLISH,
  SPEECH_SILENCE_TIMEOUT_MS,
} from "@/lib/config";
import { toDisplayText } from "@/lib/language";
import { Language } from "@/lib/types";

export interface SpeechRecognitionCallbacks {
  onInterimResult?: (text: string) => void;
  onFinalResult?: (text: string, rawText: string) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export function useSpeechRecognition(language: Language = "en") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestInterimRef = useRef<string>("");
  const isListeningRef = useRef(false);
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [interimCaption, setInterimCaption] = useState("");

  const langCode =
    language === "hinglish" ? RECOGNITION_LANG_HINGLISH : RECOGNITION_LANG_ENGLISH;

  useEffect(() => {
    if (typeof window === "undefined") return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const startListening = useCallback(
    (callbacks: SpeechRecognitionCallbacks) => {
      if (typeof window === "undefined") return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setIsSupported(false);
        callbacks.onError?.("SpeechRecognition not supported in this browser.");
        return;
      }

      // Stop previous instance if running
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = langCode;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;

      let hasSentFinal = false;

      const finalizeUtterance = (rawText: string) => {
        clearSilenceTimer();
        if (hasSentFinal) return;
        const clean = toDisplayText(rawText);
        if (!clean) return;

        hasSentFinal = true;
        setInterimCaption("");
        latestInterimRef.current = "";

        // Safe abort after finalization
        try {
          recognition.abort();
        } catch {}

        callbacks.onFinalResult?.(clean, rawText);
      };

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
        hasSentFinal = false;
        callbacks.onStart?.();
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interimText = "";
        let finalChunk = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const transcript = res[0].transcript || "";
          if (res.isFinal) {
            finalChunk += " " + transcript;
          } else {
            interimText += " " + transcript;
          }
        }

        const rawCombined = (finalChunk + " " + interimText).trim();
        const displaySafe = toDisplayText(rawCombined);

        if (displaySafe) {
          latestInterimRef.current = rawCombined;
          setInterimCaption(displaySafe);
          callbacks.onInterimResult?.(displaySafe);

          // Section E: 700ms silence detection after speech stops
          clearSilenceTimer();
          silenceTimerRef.current = setTimeout(() => {
            if (latestInterimRef.current && !hasSentFinal) {
              finalizeUtterance(latestInterimRef.current);
            }
          }, SPEECH_SILENCE_TIMEOUT_MS);
        }

        if (finalChunk.trim()) {
          finalizeUtterance(finalChunk.trim());
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        if (event.error === "aborted" || event.error === "no-speech") {
          return;
        }
        console.warn("[SpeechRecognition Error]", event.error);
        callbacks.onError?.(event.error);
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        setIsListening(false);
        clearSilenceTimer();
        callbacks.onEnd?.();
      };

      try {
        recognition.start();
      } catch (e) {
        console.warn("[SpeechRecognition Start Failed]", e);
      }
    },
    [clearSilenceTimer, langCode]
  );

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    setInterimCaption("");
    latestInterimRef.current = "";
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    isListeningRef.current = false;
    setIsListening(false);
  }, [clearSilenceTimer]);

  return {
    startListening,
    stopListening,
    isListening,
    isSupported,
    interimCaption,
  };
}
