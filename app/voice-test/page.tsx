"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { VoicePlayer } from "@/lib/speech";

const FEMALE_VOICES = [
  { name: "Kore", desc: "Current default - Firm, clear, professional tone" },
  { name: "Erinome", desc: "Warm, grounded, articulated" },
  { name: "Sulafat", desc: "Direct, confident, crisp delivery" },
  { name: "Aoede", desc: "Breezy, bright, modern" },
  { name: "Leda", desc: "Youthful, energetic, direct" },
  { name: "Zephyr", desc: "Gentle, calm, measured" },
  { name: "Autonoe", desc: "Deep, composed, reassuring" },
  { name: "Callirrhoe", desc: "Expressive, melodic, poised" },
  { name: "Despina", desc: "Clear, brisk, articulate" },
];

const ENGLISH_SENTENCE =
  "Hi, this is Aria from Aura Skincare. Your order is on its way and will arrive by tomorrow evening.";

const HINGLISH_SENTENCE =
  "Namaste, main Aura Skincare se Aria hoon. Aapka order dispatch ho chuka hai aur kal shaam tak deliver ho jayega.";

export default function VoiceTestPage() {
  const [activeVoice, setActiveVoice] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<"en" | "hinglish" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const playerRef = useRef<VoicePlayer | null>(null);

  const getPlayer = () => {
    if (!playerRef.current) {
      playerRef.current = new VoicePlayer();
    }
    return playerRef.current;
  };

  const stopAudio = () => {
    if (playerRef.current) {
      playerRef.current.stop();
    }
    setActiveVoice(null);
    setActiveLang(null);
    setIsLoading(false);
    setStatusMessage("Playback stopped.");
  };

  const playVoice = async (voiceName: string, lang: "en" | "hinglish") => {
    stopAudio();

    const textToSpeak = lang === "en" ? ENGLISH_SENTENCE : HINGLISH_SENTENCE;
    setActiveVoice(voiceName);
    setActiveLang(lang);
    setIsLoading(true);
    setStatusMessage(`Requesting WAV audio for ${voiceName} (${lang})...`);

    const player = getPlayer();

    await player.playText(
      textToSpeak,
      {
        onStart: () => {
          setIsLoading(false);
          setStatusMessage(`Now playing: ${voiceName} (${lang}) - standard 24kHz WAV`);
        },
        onEnd: () => {
          setActiveVoice(null);
          setActiveLang(null);
          setIsLoading(false);
          setStatusMessage(`Finished playing ${voiceName}.`);
        },
        onError: (err) => {
          console.error(`[VoiceTest] Error for voice ${voiceName}:`, err);
          setActiveVoice(null);
          setActiveLang(null);
          setIsLoading(false);
          setStatusMessage(`Error playing ${voiceName}: ${String(err)}`);
        },
      },
      undefined,
      lang,
      voiceName
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#252820] font-sans p-6 sm:p-12">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#E6E4DD] pb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#707068] bg-[#F0EFE9] px-2.5 py-1 rounded-full">
                Developer Tool
              </span>
              <span className="text-xs font-medium text-[#10b981] bg-[#d1fae5] px-2 py-0.5 rounded-full">
                24kHz WAV Direct
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#1A1C16]">
              Aria Voice Evaluation Suite
            </h1>
            <p className="text-sm text-[#55584E] mt-1">
              Listen to candidate Gemini prebuilt female voices to choose the most confident one.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-medium text-[#252820] hover:text-[#000] border border-[#D5D3CA] hover:border-[#1A1C16] px-4 py-2 rounded-full transition-colors bg-white shadow-xs"
            >
              Back to Aria Agent
            </Link>
          </div>
        </header>

        {/* Test Scripts Banner */}
        <section className="bg-white rounded-2xl border border-[#E6E4DD] p-6 mb-8 shadow-xs">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#707068] mb-3">
            Standard Benchmark Sentences
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EDECE6]">
              <span className="text-xs font-medium text-[#3b82f6] uppercase tracking-wide">
                1. English (India)
              </span>
              <p className="text-sm text-[#252820] mt-1 italic font-serif">
                &ldquo;{ENGLISH_SENTENCE}&rdquo;
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EDECE6]">
              <span className="text-xs font-medium text-[#8b5cf6] uppercase tracking-wide">
                2. Roman Hinglish
              </span>
              <p className="text-sm text-[#252820] mt-1 italic font-serif">
                &ldquo;{HINGLISH_SENTENCE}&rdquo;
              </p>
            </div>
          </div>
          {statusMessage && (
            <div className="mt-4 pt-3 border-t border-[#F0EFE9] flex items-center justify-between text-xs text-[#707068]">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                <span>{statusMessage}</span>
              </div>
              {(activeVoice || isLoading) && (
                <button
                  onClick={stopAudio}
                  className="text-xs text-[#dc2626] hover:underline font-medium"
                >
                  Stop Audio
                </button>
              )}
            </div>
          )}
        </section>

        {/* Voices Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {FEMALE_VOICES.map((v) => {
            const isThisActive = activeVoice === v.name;
            const isEnPlaying = isThisActive && activeLang === "en";
            const isHinglishPlaying = isThisActive && activeLang === "hinglish";

            return (
              <div
                key={v.name}
                className={`bg-white rounded-2xl border transition-all p-5 flex flex-col justify-between ${
                  isThisActive
                    ? "border-[#1A1C16] ring-1 ring-[#1A1C16] shadow-sm"
                    : "border-[#E6E4DD] hover:border-[#D5D3CA]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-serif font-medium text-lg text-[#1A1C16]">
                      {v.name}
                    </h3>
                    {v.name === "Kore" && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#707068] bg-[#F0EFE9] px-2 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#707068] mb-4">{v.desc}</p>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#F5F4EE]">
                  <button
                    onClick={() => playVoice(v.name, "en")}
                    disabled={isLoading && !isEnPlaying}
                    className={`w-full text-xs font-medium py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                      isEnPlaying
                        ? "bg-[#1A1C16] text-white"
                        : "bg-[#FAF9F6] hover:bg-[#F0EFE9] text-[#252820] border border-[#E6E4DD]"
                    }`}
                  >
                    <span>{isEnPlaying ? "■ Stop" : "▶ Play English"}</span>
                  </button>

                  <button
                    onClick={() => playVoice(v.name, "hinglish")}
                    disabled={isLoading && !isHinglishPlaying}
                    className={`w-full text-xs font-medium py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                      isHinglishPlaying
                        ? "bg-[#1A1C16] text-white"
                        : "bg-[#FAF9F6] hover:bg-[#F0EFE9] text-[#252820] border border-[#E6E4DD]"
                    }`}
                  >
                    <span>{isHinglishPlaying ? "■ Stop" : "▶ Play Hinglish"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        {/* Audio Pipeline Architecture Note */}
        <footer className="mt-12 p-6 rounded-2xl bg-white border border-[#E6E4DD] text-xs text-[#707068] space-y-2">
          <p className="font-semibold text-[#252820] uppercase tracking-wider text-[11px]">
            Audio Pipeline Specification
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Raw Gemini 16-bit PCM (24000 Hz, mono) wrapped with valid 44-byte WAV header on server.</li>
            <li>Plain HTML5 Audio element playback (no Web Audio API resampling, zero clipping).</li>
            <li>Full diagnostic telemetry logged to the browser developer console on every turn.</li>
          </ul>
        </footer>
      </div>
    </div>
  );
}
