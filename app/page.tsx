"use client";

import React from "react";
import { Header } from "@/components/Header";
import { VoiceOrb } from "@/components/VoiceOrb";
import { TranscriptView } from "@/components/TranscriptView";
import { TestOrdersCard } from "@/components/TestOrdersCard";
import { FallbackInput } from "@/components/FallbackInput";
import { PostCallSummaryView } from "@/components/PostCallSummaryView";
import { useCall } from "@/hooks/useCall";
import {
  Phone,
  PhoneOff,
  Hand,
  Mic,
  MicOff,
  Languages,
} from "lucide-react";

export default function Home() {
  const {
    callState,
    language,
    transcript,
    interimCaption,
    isMuted,
    callDuration,
    summary,
    isSummarizing,
    timing,
    headphoneMode,
    toggleHeadphoneMode,
    startCall,
    endCall,
    chooseLanguage,
    switchLanguage,
    toggleMute,
    interruptSpeech,
    sendManualMessage,
  } = useCall();

  const isCallActive = callState !== "Idle" && callState !== "Ended";
  const isSpeaking = callState === "Speaking" || callState === "Greeting";

  const handleSelectPrompt = (promptText: string) => {
    if (!isCallActive) {
      startCall().then(() => {
        setTimeout(() => {
          sendManualMessage(promptText);
        }, 1200);
      });
    } else {
      sendManualMessage(promptText);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-aura-bg">
      <Header headphoneMode={headphoneMode} toggleHeadphoneMode={toggleHeadphoneMode} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Voice Agent Card (Left/Center) */}
          <section className="lg:col-span-7 bg-white rounded-3xl border border-aura-border shadow-card p-5 sm:p-7 space-y-5">
            {/* Hero Headline */}
            <div className="text-center mb-4">
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-aura-text-primary tracking-tight">
                Customer support, naturally.
              </h1>
              <p className="mt-2 text-sm text-aura-text-secondary max-w-xl mx-auto">
                Your personal voice assistant for orders, deliveries and returns.
              </p>
            </div>
            {/* Call Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-center sm:text-left">
                <h1 className="text-lg font-bold text-aura-text-primary tracking-tight">
                  Voice Assistant Aria
                </h1>
                <p className="text-xs text-aura-text-secondary">
                  Natural customer support in Indian English & Hinglish
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {isSpeaking && (
                  <button
                    onClick={interruptSpeech}
                    aria-label="Interrupt Aria and speak"
                    title="Press Space or click to interrupt"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs sm:text-sm font-semibold shadow-2xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Hand className="w-3.5 h-3.5" />
                    <span>Interrupt</span>
                  </button>
                )}

                {isCallActive && (
                  <button
                    onClick={toggleMute}
                    aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs sm:text-sm font-medium border transition-all ${
                      isMuted
                        ? "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200"
                        : "bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200"
                    }`}
                  >
                    {isMuted ? (
                      <>
                        <MicOff className="w-3.5 h-3.5 text-rose-600" />
                        <span>Muted</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5 text-stone-600" />
                        <span>Mute Mic</span>
                      </>
                    )}
                  </button>
                )}

                {!isCallActive ? (
                  <button
                    onClick={startCall}
                    aria-label="Start voice call with Aria"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-aura-sage hover:bg-aura-sage-hover text-white text-sm font-semibold shadow-2xs transition-all hover:shadow hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Start Call</span>
                  </button>
                ) : (
                  <button
                    onClick={endCall}
                    aria-label="End voice call"
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-semibold shadow-2xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>End Call</span>
                  </button>
                )}
              </div>
            </div>

            {/* Language Selector Bar (labels strictly: "English (India)" and "Hinglish") */}
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-aura-bg/80 border border-aura-border text-xs">
              <div className="flex items-center gap-2 text-aura-text-secondary">
                <Languages className="w-4 h-4 text-aura-sage-hover" />
                <span className="font-medium text-aura-text-primary">Conversation Language:</span>
              </div>
              <div className="inline-flex items-center bg-stone-200/80 p-0.5 rounded-xl text-xs font-medium">
                <button
                  type="button"
                  onClick={() => switchLanguage("en")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    language === "en"
                      ? "bg-white text-aura-text-primary shadow-2xs font-semibold"
                      : "text-aura-text-secondary hover:text-aura-text-primary"
                  }`}
                >
                  English (India)
                </button>
                <button
                  type="button"
                  onClick={() => switchLanguage("hinglish")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    language === "hinglish"
                      ? "bg-white text-aura-text-primary shadow-2xs font-semibold"
                      : "text-aura-text-secondary hover:text-aura-text-primary"
                  }`}
                >
                  Hinglish
                </button>
              </div>
            </div>

            {/* Central Animated Voice Orb */}
            <VoiceOrb
              state={callState}
              onInterrupt={interruptSpeech}
              callDuration={callDuration}
              timing={timing}
              isMuted={isMuted}
              onSelectLanguage={(lang) => chooseLanguage(lang)}
            />

            {/* Live Chat / Transcript Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-aura-text-secondary px-1">
                <span>Live Conversation Transcript</span>
                {isCallActive && (
                  <span className="text-[11px] text-aura-sage-hover font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-aura-sage-hover animate-pulse" />
                    {callState === "Speaking" || callState === "Greeting"
                      ? "Speaking (mic paused)"
                      : isMuted
                      ? "Microphone Muted"
                      : `Listening (${language === "hinglish" ? "Hinglish" : "English"})`}
                  </span>
                )}
              </div>

              <TranscriptView
                transcript={transcript}
                interimText={interimCaption}
                isCallActive={isCallActive}
              />
            </div>

            {/* Fallback Text Input */}
            <div>
              <FallbackInput
                onSend={sendManualMessage}
                disabled={!isCallActive}
                isCallActive={isCallActive}
              />
            </div>

            {/* Post-Call Summary (shown when call is ended) */}
            {callState === "Ended" && (
              <div className="pt-2">
                <PostCallSummaryView
                  summary={summary}
                  transcript={transcript}
                  isSummarizing={isSummarizing}
                  onStartNewCall={startCall}
                />
              </div>
            )}
          </section>

          {/* Right Sidebar: Test Orders & Prompts */}
          <aside className="lg:col-span-5 space-y-4">
            <TestOrdersCard
              onSelectPrompt={handleSelectPrompt}
              isCallActive={isCallActive}
            />

            {/* Brand Policy Cheatsheet */}
            <div className="p-4 rounded-2xl bg-white border border-aura-border shadow-soft space-y-2.5">
              <h3 className="text-xs font-bold text-aura-text-primary tracking-tight">
                Brand Policy Cheatsheet
              </h3>
              <ul className="text-[11px] text-aura-text-secondary space-y-1.5 list-disc list-inside leading-snug">
                <li>
                  <strong className="text-aura-text-primary">Free Shipping:</strong> On orders above ₹499 (₹50 fee below ₹499).
                </li>
                <li>
                  <strong className="text-aura-text-primary">Returns:</strong> Within 7 days of delivery for unopened products.
                </li>
                <li>
                  <strong className="text-aura-text-primary">Cancellations:</strong> Allowed only while status is <em>Processing</em>.
                </li>
                <li>
                  <strong className="text-aura-text-primary">Cash on Delivery:</strong> Available up to ₹2,500.
                </li>
                <li>
                  <strong className="text-aura-text-primary">Support Tickets:</strong> Escalated tickets are responded to within 24 hours.
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-aura-border py-4 bg-white/50 text-center text-xs text-aura-text-muted">
        Aria · Aura Skincare Voice Support AI · Powered by Google Gemini & Web Speech API
      </footer>
    </div>
  );
}
