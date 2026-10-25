"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { VoicePlayer, resumeAudioContext, resetLockedVoice } from "@/lib/speech";
import { Language } from "@/lib/types";

export interface AudioQueueCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

export function useAudioQueue() {
  const playerRef = useRef<VoicePlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    playerRef.current = new VoicePlayer();
    return () => {
      playerRef.current?.stop();
      resetLockedVoice();
    };
  }, []);

  const play = useCallback(
    async (text: string, callbacks?: AudioQueueCallbacks, language: Language = "en") => {
      if (!playerRef.current) {
        playerRef.current = new VoicePlayer();
      }

      await resumeAudioContext();

      return playerRef.current.playText(
        text,
        {
          onStart: () => {
            setIsPlaying(true);
            callbacks?.onStart?.();
          },
          onEnd: () => {
            setIsPlaying(false);
            callbacks?.onEnd?.();
          },
          onError: (err) => {
            setIsPlaying(false);
            callbacks?.onError?.(err);
          },
        },
        (voiceName) => {
          // Voice info logged in speech.ts; no UI badge
          console.log(`[Audio] Voice selected: ${voiceName}`);
        },
        language
      );
    },
    []
  );

  const stop = useCallback(() => {
    playerRef.current?.stop();
    setIsPlaying(false);
  }, []);

  return {
    play,
    stop,
    isPlaying,
  };
}
