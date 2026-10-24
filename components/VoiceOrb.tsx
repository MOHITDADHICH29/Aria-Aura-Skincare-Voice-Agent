"use client";

import React from "react";
import { Mic, Volume2, Sparkles, PhoneOff, Hand } from "lucide-react";
import { CallState } from "@/lib/useVoiceAgent";

interface VoiceOrbProps {
  state: CallState;
  onInterrupt?: () => void;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({ state, onInterrupt }) => {
  const isSpeaking = state === "Speaking";
  const isListening = state === "Listening";
  const isThinking = state === "Thinking";
  const isEnded = state === "Ended";

  const handleClick = () => {
    if (isSpeaking && onInterrupt) {
      onInterrupt();
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center py-5 select-none">
      {/* Outer Glow / Animation Container */}
      <div
        onClick={handleClick}
        role="button"
        tabIndex={isSpeaking ? 0 : -1}
        aria-label={
          isSpeaking
            ? "Aria is speaking. Tap orb to interrupt"
            : `Voice orb state: ${state}`
        }
        className={`relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 ${
          isSpeaking
            ? "cursor-pointer hover:scale-105 ring-4 ring-aura-blush ring-offset-2 active:scale-95"
            : ""
        }`}
      >
        {/* State: Speaking - Concentric expanding rings */}
        {isSpeaking && (
          <>
            <span className="absolute inset-0 rounded-full bg-aura-sage/20 animate-ping duration-1000" />
            <span className="absolute -inset-3 rounded-full border border-aura-sage/40 animate-pulse" />
            <span className="absolute -inset-6 rounded-full border border-aura-sage/20 animate-pulse delay-150" />
          </>
        )}

        {/* State: Listening - Gentle pulsing aura */}
        {isListening && (
          <>
            <span className="absolute -inset-2 rounded-full bg-aura-sage-light animate-pulse duration-700" />
            <span className="absolute -inset-4 rounded-full border border-aura-sage/30 animate-pulse duration-1000" />
          </>
        )}

        {/* State: Thinking - Rotating soft gradient border */}
        {isThinking && (
          <div className="absolute -inset-3 rounded-full border-2 border-dashed border-aura-blush-hover animate-spin duration-3000" />
        )}

        {/* Core Orb */}
        <div
          className={`w-36 h-36 rounded-full shadow-card flex flex-col items-center justify-center transition-all duration-500 relative overflow-hidden ${
            isListening
              ? "bg-gradient-to-tr from-[#7FA890] to-[#A3C8B2] text-white scale-100"
              : isThinking
              ? "bg-gradient-to-tr from-[#EAC4B5] to-[#8FB8A0] text-white animate-pulse"
              : isSpeaking
              ? "bg-gradient-to-tr from-[#6EA082] to-[#8FB8A0] text-white shadow-lg shadow-aura-sage/30"
              : isEnded
              ? "bg-gray-200 text-gray-500"
              : "bg-gradient-to-tr from-[#8FB8A0] to-[#A8CDB8] text-white"
          }`}
        >
          {/* Subtle inner gloss highlight */}
          <div className="absolute top-0 left-1/4 w-1/2 h-8 rounded-full bg-white/20 blur-sm pointer-events-none" />

          {/* Icon in center */}
          <div className="z-10 transition-transform duration-300">
            {isListening && <Mic className="w-9 h-9 animate-bounce" />}
            {isThinking && <Sparkles className="w-9 h-9 animate-spin" />}
            {isSpeaking && <Volume2 className="w-9 h-9 animate-pulse" />}
            {isEnded && <PhoneOff className="w-9 h-9" />}
            {state === "Idle" && <Sparkles className="w-9 h-9 opacity-80" />}
          </div>

          {/* Micro text inside orb if speaking */}
          {isSpeaking && (
            <span className="z-10 text-[10px] font-semibold tracking-wide uppercase mt-1 opacity-95 bg-black/20 px-2 py-0.5 rounded-full">
              Tap to Interrupt
            </span>
          )}
        </div>
      </div>

      {/* State label badge & explicit interrupt button */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium tracking-wide transition-colors ${
              isListening
                ? "bg-aura-sage-light text-aura-sage-hover"
                : isThinking
                ? "bg-aura-blush text-amber-800"
                : isSpeaking
                ? "bg-emerald-50 text-emerald-700"
                : isEnded
                ? "bg-gray-100 text-gray-600"
                : "bg-aura-sage-light/60 text-aura-text-secondary"
            }`}
          >
            {isListening && "Listening to you…"}
            {isThinking && "Aria is thinking…"}
            {isSpeaking && "Aria is speaking…"}
            {isEnded && "Call ended"}
            {state === "Idle" && "Ready to start call"}
          </div>

          {/* Explicit Interrupt button shown only while Speaking */}
          {isSpeaking && (
            <button
              onClick={onInterrupt}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors shadow-sm active:scale-95"
              aria-label="Interrupt Aria and start speaking"
            >
              <Hand className="w-3 h-3" />
              <span>Interrupt</span>
            </button>
          )}
        </div>

        <p className="text-xs text-aura-text-secondary text-center">
          {state === "Idle" && "Click Start Call to speak naturally with Aria"}
          {isListening && "Speak into your mic — Aria is listening"}
          {isThinking && "Formulating concise policy response"}
          {isSpeaking && "Half-duplex: mic is paused. Click orb or Interrupt to speak."}
          {isEnded && "Transcript & structured JSON summary ready below"}
        </p>
      </div>
    </div>
  );
};
