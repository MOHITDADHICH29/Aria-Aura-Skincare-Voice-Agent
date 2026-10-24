"use client";

import React, { useEffect, useRef } from "react";
import { Wrench } from "lucide-react";
import { TranscriptItem } from "@/lib/useVoiceAgent";

interface TranscriptViewProps {
  transcript: TranscriptItem[];
  interimText?: string;
  isCallActive: boolean;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  transcript,
  interimText,
  isCallActive,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, interimText]);

  return (
    <div className="w-full flex flex-col h-72 sm:h-80 overflow-y-auto px-4 py-3 rounded-2xl bg-white/70 border border-aura-border shadow-soft space-y-3">
      {transcript.length === 0 && !interimText && (
        <div className="h-full flex flex-col items-center justify-center text-center text-aura-text-secondary px-6">
          <p className="text-sm font-medium">No conversation yet</p>
          <p className="text-xs text-aura-text-muted mt-1 max-w-xs">
            Start the call to talk to Aria about order tracking, returns, cancellations, or shipping.
          </p>
        </div>
      )}

      {transcript.map((item) => {
        const isCustomer = item.speaker === "customer";
        return (
          <div
            key={item.id}
            className={`flex flex-col ${isCustomer ? "items-end" : "items-start"}`}
          >
            {/* Tool invocation badge if present */}
            {!isCustomer && item.toolCalls && item.toolCalls.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5 ml-1">
                {item.toolCalls.map((tc, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[11px] font-mono border border-stone-200"
                  >
                    <Wrench className="w-2.5 h-2.5 text-stone-500" />
                    {tc.name === "get_order_details" && `Looked up ${tc.args?.order_id || "order"}`}
                    {tc.name === "cancel_order" && `Attempted cancellation ${tc.args?.order_id || "order"}`}
                    {tc.name !== "get_order_details" && tc.name !== "cancel_order" && tc.name}
                  </span>
                ))}
              </div>
            )}

            {/* Bubble */}
            <div
              className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed transition-all shadow-sm ${
                isCustomer
                  ? "bg-aura-sage-light text-aura-text-primary rounded-br-xs border border-aura-sage-soft"
                  : "bg-white text-aura-text-primary rounded-bl-xs border border-aura-border"
              }`}
            >
              <div className="flex items-center justify-between gap-3 text-[10px] text-aura-text-muted mb-1 select-none">
                <span className="font-semibold uppercase tracking-wider">
                  {isCustomer ? "You" : "Aria"}
                </span>
                <span>{item.timestamp}</span>
              </div>
              <p className="whitespace-pre-wrap">{item.text}</p>
            </div>
          </div>
        );
      })}

      {/* Interim live speech */}
      {isCallActive && interimText && interimText.trim().length > 0 && (
        <div className="flex flex-col items-end">
          <div className="max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-aura-sage-light/50 text-aura-text-secondary border border-dashed border-aura-sage/40 rounded-br-xs italic animate-pulse">
            <span className="text-[10px] uppercase font-semibold text-aura-text-muted block not-italic mb-0.5">
              Speaking…
            </span>
            &ldquo;{interimText}&rdquo;
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
