"use client";

import React from "react";
import { Header } from "@/components/Header";
import { VoiceOrb } from "@/components/VoiceOrb";
import { TranscriptView } from "@/components/TranscriptView";
import { TestOrdersCard } from "@/components/TestOrdersCard";
import { FallbackInput } from "@/components/FallbackInput";
import { PostCallSummaryView } from "@/components/PostCallSummaryView";
import { useVoiceAgent } from "@/lib/useVoiceAgent";
import { Phone, PhoneOff, Headphones, AlertCircle } from "lucide-react";

export default function Home() {
  const {
    callState,
    transcript,
    interimText,
    errorMessage,
    summary,
    isSummarizing,
    isBrowserSupported,
    startCall,
    endCall,
    interruptSpeech,
    handleCustomerUtterance,
    setErrorMessage,
  } = useVoiceAgent();

  const isCallActive =
    callState === "Listening" ||
    callState === "Thinking" ||
    callState === "Speaking";

  const handleSelectPrompt = (promptText: string) => {
    if (!isCallActive) {
      // If call is not yet started, prompt user or start call
      startCall().then(() => {
        setTimeout(() => {
          handleCustomerUtterance(promptText);
        }, 1200);
      });
    } else {
      handleCustomerUtterance(promptText);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-aura-bg">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Error notification banner if any */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Notice</p>
              <p className="mt-0.5 text-amber-700">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-amber-600 hover:text-amber-800 font-bold px-2 py-0.5"
            >
              ×
            </button>
          </div>
        )}

        {!isBrowserSupported && (
          <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs sm:text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Browser Recommendation</p>
              <p className="mt-0.5 text-blue-700">
                Web Speech API works best in Google Chrome or Microsoft Edge.
                You can still test Aria using the fallback text input below!
              </p>
            </div>
          </div>
        )}

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Voice Agent Card (Left/Center) */}
          <section className="lg:col-span-7 bg-white rounded-3xl border border-aura-border shadow-card p-5 sm:p-7 space-y-6">
            {/* Call Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-center sm:text-left">
                <h1 className="text-lg font-bold text-aura-text-primary tracking-tight">
                  Voice Assistant Aria
                </h1>
                <p className="text-xs text-aura-text-secondary">
                  Natural Indian English customer support for Aura Skincare
                </p>
              </div>

              {/* Start / End Call Pill Button */}
              <div>
                {!isCallActive ? (
                  <button
                    onClick={startCall}
                    aria-label="Start voice call with Aria"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-aura-sage hover:bg-aura-sage-hover text-white text-sm font-semibold shadow-sm transition-all hover:shadow hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Start Call</span>
                  </button>
                ) : (
                  <button
                    onClick={endCall}
                    aria-label="End voice call"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>End Call</span>
                  </button>
                )}
              </div>
            </div>

            {/* Central Animated Voice Orb */}
            <VoiceOrb state={callState} onInterrupt={interruptSpeech} />

            {/* Headphone Tip */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-aura-text-muted select-none">
              <Headphones className="w-3.5 h-3.5" />
              <span>
                Tip: Use headphones for the best experience (speaker echo can trigger false barge-in).
              </span>
            </div>

            {/* Live Chat / Transcript Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-aura-text-secondary px-1">
                <span>Live Conversation Transcript</span>
                {isCallActive && (
                  <span className="text-[11px] text-aura-sage-hover font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-aura-sage-hover animate-pulse" />
                    Live audio connected
                  </span>
                )}
              </div>

              <TranscriptView
                transcript={transcript}
                interimText={interimText}
                isCallActive={isCallActive}
              />
            </div>

            {/* Fallback Text Input */}
            <div>
              <FallbackInput
                onSend={handleCustomerUtterance}
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
