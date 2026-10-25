"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { Mic, MicOff, Volume2, Sparkles, PhoneOff, Hand, Clock } from "lucide-react";
import { CallState, TimingDiagnostics, Language } from "@/lib/types";

interface VoiceOrbProps {
  state: CallState;
  onInterrupt?: () => void;
  callDuration?: number;
  timing?: TimingDiagnostics | null;
  isMuted?: boolean;
  onSelectLanguage?: (lang: Language) => void;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  state,
  onInterrupt,
  callDuration = 0,
  timing = null,
  isMuted = false,
  onSelectLanguage,
}) => {
  const isSpeaking = state === "Speaking";
  const isListening = state === "Listening";
  const isThinking = state === "Thinking";
  const isGreeting = state === "Greeting";
  const isLanguageChoice = state === "LanguageChoice";
  const isEnded = state === "Ended";
  const isCallActive = state !== "Idle" && state !== "Ended";

  const handleClick = () => {
    if (isSpeaking && onInterrupt) {
      onInterrupt();
    }
  };

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const orbRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!orbRef.current) return;
  const ctx = gsap.context(() => {
    // Clean previous animations
    gsap.killTweensOf(orbRef.current);
    // Base idle animation
    if (state === "Idle") {
      gsap.fromTo(orbRef.current, { scale: 0.98 }, { scale: 1.02, duration: 2, yoyo: true, repeat: -1, ease: "power1.inOut" });
    } else {
      gsap.to(orbRef.current, { scale: 1, duration: 0.3, ease: "power2.out" });
    }
    // State-specific animations
    if (state === "Listening" || state === "LanguageChoice") {
      gsap.fromTo(".pulse-ring", { opacity: 0.4, scale: 0.9 }, { opacity: 0.8, scale: 1.1, repeat: -1, yoyo: true, duration: 1, ease: "sine.inOut" });
    }
    if (state === "Thinking") {
      gsap.to(".thinking-spinner", { rotation: 360, repeat: -1, duration: 3, ease: "linear" });
    }
    if (state === "Speaking" || state === "Greeting") {
      gsap.fromTo(".speak-ring", { opacity: 0.3, scale: 0.8 }, { opacity: 0.7, scale: 1.2, repeat: -1, yoyo: true, duration: 0.8, ease: "power1.out" });
    }
  }, orbRef);
  return () => ctx.revert();
}, [state]);

return (
    <div className="relative flex flex-col items-center justify-center py-4 select-none">
      {/* Outer Glow / Animation Container */}
      <div
        onClick={handleClick}
        role="button"
        tabIndex={isSpeaking ? 0 : -1}
        aria-label={
          isSpeaking
            ? "Aria is speaking. Tap orb or press Space to interrupt"
            : `Voice orb state: ${state}`
        }
        className={`relative w-36 h-36 sm:w-40 sm:h-40 rounded-full flex items-center justify-center transition-all duration-300 ${
          isSpeaking
            ? "cursor-pointer hover:scale-105 ring-4 ring-aura-blush ring-offset-2 active:scale-95"
            : ""
        }`}
      >
        {/* Speaking Rings */}
        {isSpeaking && (
          <>
            <span className="absolute inset-0 rounded-full bg-aura-sage/20 animate-ping duration-1000 speak-ring" />
            <span className="absolute -inset-3 rounded-full border border-aura-sage/40 animate-pulse speak-ring" />
            <span className="absolute -inset-6 rounded-full border border-aura-sage/20 animate-pulse delay-150 speak-ring" />
          </>
        )}

        {/* Listening Pulsing Aura */}
        {(isListening || isLanguageChoice) && !isMuted && (
          <>
            <span className="absolute -inset-2 rounded-full bg-aura-sage-light animate-pulse duration-700" />
            <span className="absolute -inset-4 rounded-full border border-aura-sage/30 animate-pulse duration-1000" />
          </>
        )}

        {/* Thinking Spinner */}
        {isThinking && (
          <div className="absolute -inset-3 rounded-full border-2 border-dashed border-aura-blush-hover animate-spin duration-3000" />
        )}

        {/* Core Orb */}
        <div
          className={`w-32 h-32 sm:w-36 sm:h-36 rounded-full shadow-card flex flex-col items-center justify-center transition-all duration-500 relative overflow-hidden ${
            isMuted && isListening
              ? "bg-stone-300 text-stone-600"
              : isListening || isLanguageChoice
              ? "bg-gradient-to-tr from-[#7FA890] to-[#A3C8B2] text-white scale-100"
              : isThinking
              ? "bg-gradient-to-tr from-[#EAC4B5] to-[#8FB8A0] text-white animate-pulse"
              : isSpeaking || isGreeting
              ? "bg-gradient-to-tr from-[#6EA082] to-[#8FB8A0] text-white shadow-lg shadow-aura-sage/30"
              : isEnded
              ? "bg-gray-200 text-gray-500"
              : "bg-gradient-to-tr from-[#8FB8A0] to-[#A8CDB8] text-white"
          }`}
        >
          <div className="absolute top-0 left-1/4 w-1/2 h-8 rounded-full bg-white/20 blur-sm pointer-events-none" />

          <div className="z-10 transition-transform duration-300">
            {isMuted && isListening ? (
              <MicOff className="w-9 h-9 text-rose-600 animate-pulse" />
            ) : isListening || isLanguageChoice ? (
              <Mic className="w-9 h-9 animate-bounce" />
            ) : isThinking ? (
              <Sparkles className="w-9 h-9 animate-spin" />
            ) : isSpeaking || isGreeting ? (
              <Volume2 className="w-9 h-9 animate-pulse" />
            ) : isEnded ? (
              <PhoneOff className="w-9 h-9" />
            ) : (
              <Sparkles className="w-9 h-9 opacity-80" />
            )}
          </div>

          {isSpeaking && (
            <span className="z-10 text-[9px] font-semibold tracking-wide uppercase mt-1 opacity-95 bg-black/20 px-2 py-0.5 rounded-full">
              Tap / Space to Interrupt
            </span>
          )}
        </div>
      </div>

      {/* Section A.4: Two large buttons under the orb during LanguageChoice step */}
      {isLanguageChoice && onSelectLanguage && (
        <div className="mt-4 flex items-center justify-center gap-3 w-full max-w-xs animate-fadeIn">
          <button
            type="button"
            onClick={() => onSelectLanguage("en")}
            className="flex-1 py-2.5 px-4 rounded-xl bg-white border-2 border-aura-sage hover:bg-aura-sage hover:text-white text-aura-text-primary text-sm font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            English
          </button>
          <button
            type="button"
            onClick={() => onSelectLanguage("hinglish")}
            className="flex-1 py-2.5 px-4 rounded-xl bg-white border-2 border-aura-sage hover:bg-aura-sage hover:text-white text-aura-text-primary text-sm font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Hinglish
          </button>
        </div>
      )}

      {/* State label badge, timer & interrupt button */}
      <div className="mt-4 flex flex-col items-center gap-1.5">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {/* State Badge */}
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium tracking-wide transition-colors flex items-center gap-1.5 ${
              isMuted && isListening
                ? "bg-rose-100 text-rose-800 border border-rose-200"
                : isListening || isLanguageChoice
                ? "bg-aura-sage-light text-aura-sage-hover"
                : isThinking
                ? "bg-aura-blush text-amber-800"
                : isSpeaking || isGreeting
                ? "bg-emerald-50 text-emerald-700"
                : isEnded
                ? "bg-gray-100 text-gray-600"
                : "bg-aura-sage-light/60 text-aura-text-secondary"
            }`}
          >
            {isMuted && isListening ? (
              <>
                <MicOff className="w-3 h-3 text-rose-600" />
                <span>Microphone Muted</span>
              </>
            ) : isLanguageChoice ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-aura-sage-hover animate-ping" />
                <span>Choose English or Hinglish (Voice or Button)</span>
              </>
            ) : isListening ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-aura-sage-hover animate-ping" />
                <span>Listening to you…</span>
              </>
            ) : isThinking ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                <span>Aria is thinking…</span>
              </>
            ) : isSpeaking || isGreeting ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                <span>Aria is speaking…</span>
              </>
            ) : isEnded ? (
              <span>Call ended</span>
            ) : (
              <span>Ready to start call</span>
            )}
          </div>

          {/* Live Call Duration Timer */}
          {isCallActive && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 border border-stone-200 text-stone-700 text-xs font-mono font-medium shadow-2xs">
              <Clock className="w-3 h-3 text-stone-500" />
              <span>{formatDuration(callDuration)}</span>
            </div>
          )}

          {/* Interrupt button shown while Speaking */}
          {isSpeaking && (
            <button
              onClick={onInterrupt}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors shadow-2xs active:scale-95"
              aria-label="Interrupt Aria and start speaking (or press Space)"
            >
              <Hand className="w-3 h-3" />
              <span>Interrupt (Space)</span>
            </button>
          )}
        </div>


        {/* Section E.7: Timing Readout (speech end to first audio) */}
        {timing && (
          <div className="text-[11px] font-mono text-aura-text-secondary bg-aura-bg/80 px-2.5 py-0.5 rounded-md border border-aura-border/60">
            Last response time: <span className="font-semibold text-aura-sage-hover">{(timing.totalTurnMs / 1000).toFixed(1)}s</span>
            {" · "}<span className="text-stone-500">LLM: {timing.llmFirstTokenMs}ms</span>
            {" · "}<span className="text-stone-500">TTS: {timing.ttsFirstAudioMs}ms</span>
          </div>
        )}

        <p className="text-xs text-aura-text-secondary text-center max-w-sm mt-0.5">
          {state === "Idle" && "Click Start Call to speak naturally with Aria"}
          {isLanguageChoice && "Say 'English' or 'Hinglish', or click a button above"}
          {isListening && !isMuted && "Speak into your mic — Aria is listening"}
          {isListening && isMuted && "Unmute mic to continue speaking with Aria"}
          {isThinking && "Formulating concise policy response…"}
          {isSpeaking && "Mic is paused. Tap orb, click Interrupt, or press Space to speak."}
          {isEnded && "Transcript & structured JSON summary ready below"}
        </p>
      </div>
    </div>
  );
};
