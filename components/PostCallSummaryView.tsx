"use client";

import React, { useState } from "react";
import { Copy, Check, RotateCcw, FileText, CheckCircle2, AlertTriangle, ShieldCheck, HeartPulse } from "lucide-react";
import { PostCallSummary, TranscriptItem } from "@/lib/types";
import { assertNoDevanagari } from "@/lib/language";

interface PostCallSummaryViewProps {
  summary: PostCallSummary | null;
  transcript: TranscriptItem[];
  isSummarizing: boolean;
  onStartNewCall: () => void;
}

export const PostCallSummaryView: React.FC<PostCallSummaryViewProps> = ({
  summary,
  transcript,
  isSummarizing,
  onStartNewCall,
}) => {
  const [copied, setCopied] = useState(false);

  const formattedJson = summary ? JSON.stringify(summary, null, 2) : "{}";

  // Section B.8: assertNoDevanagari in development
  if (summary) {
    assertNoDevanagari(formattedJson, "PostCallSummaryView (JSON viewer)");
    assertNoDevanagari(summary.call_summary, "PostCallSummaryView (narrative summary)");
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case "POSITIVE":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "NEGATIVE":
      case "FRUSTRATED":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-stone-50 text-stone-700 border-stone-200";
    }
  };

  const getResolutionColor = (status?: string) => {
    switch (status) {
      case "RESOLVED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "POLICY_DECLINED":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "ESCALATION_NEEDED":
      case "UNRESOLVED":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-stone-50 text-stone-700 border-stone-200";
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-aura-border shadow-card p-5 sm:p-6 space-y-6 animate-fadeIn">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-aura-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-aura-sage-light text-aura-sage-hover">
              <FileText className="w-4 h-4" />
            </span>
            <h2 className="text-base font-semibold text-aura-text-primary">
              Call Summary & Analytics
            </h2>
          </div>
          <p className="text-xs text-aura-text-secondary mt-0.5">
            Structured post-call intelligence extracted automatically
          </p>
        </div>

        <button
          onClick={onStartNewCall}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-aura-sage text-white text-xs sm:text-sm font-medium hover:bg-aura-sage-hover shadow-sm transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Start new call</span>
        </button>
      </div>

      {isSummarizing ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-aura-sage border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-aura-text-primary">
            Analyzing call with Gemini…
          </p>
          <p className="text-xs text-aura-text-muted">
            Extracting customer intent, sentiment, policy decisions, and follow-ups.
          </p>
        </div>
      ) : summary ? (
        <div className="space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-aura-bg/60 border border-aura-border space-y-1">
              <span className="text-[10px] uppercase font-semibold text-aura-text-muted flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-aura-sage-hover" /> Intent
              </span>
              <p className="text-xs font-semibold text-aura-text-primary truncate">
                {summary.customer_intent}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-aura-bg/60 border border-aura-border space-y-1">
              <span className="text-[10px] uppercase font-semibold text-aura-text-muted flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Resolution
              </span>
              <span
                className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${getResolutionColor(
                  summary.resolution_status
                )}`}
              >
                {summary.resolution_status}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-aura-bg/60 border border-aura-border space-y-1">
              <span className="text-[10px] uppercase font-semibold text-aura-text-muted flex items-center gap-1">
                <HeartPulse className="w-3 h-3 text-rose-500" /> Sentiment
              </span>
              <span
                className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${getSentimentColor(
                  summary.customer_sentiment
                )}`}
              >
                {summary.customer_sentiment}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-aura-bg/60 border border-aura-border space-y-1">
              <span className="text-[10px] uppercase font-semibold text-aura-text-muted flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-500" /> Escalation
              </span>
              <span
                className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                  summary.escalation
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {summary.escalation ? "Escalated" : "Resolved by AI"}
              </span>
            </div>
          </div>

          {/* Language & Ticket Details Bar */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 border border-stone-200 font-medium">
              Language: <strong className="text-stone-900">{summary.language === "hinglish" ? "Hinglish" : "English (India)"}</strong>
            </span>
            {summary.tickets_created && summary.tickets_created.length > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                Tickets Created: <strong className="font-mono">{summary.tickets_created.join(", ")}</strong> (ETA: 24h)
              </span>
            )}
          </div>

          {/* Factual Summary */}
          <div className="p-4 rounded-xl bg-stone-50 border border-aura-border space-y-1">
            <span className="text-[11px] font-semibold text-aura-text-secondary uppercase tracking-wider block">
              Call Narrative Summary
            </span>
            <p className="text-sm text-aura-text-primary leading-relaxed">
              {summary.call_summary}
            </p>
            {summary.order_id && (
              <p className="text-xs text-aura-text-secondary pt-1">
                Referenced Order ID: <span className="font-mono font-semibold text-aura-text-primary">{summary.order_id}</span>
              </p>
            )}
          </div>

          {/* Structured JSON Output Block */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-aura-text-primary">
                Structured Post-Call JSON (/api/summary)
              </span>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-aura-text-secondary bg-aura-bg hover:text-aura-text-primary hover:bg-stone-100 transition-colors border border-aura-border"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-stone-900 text-stone-100 text-xs font-mono overflow-x-auto max-h-60 leading-relaxed shadow-inner">
              <code>{formattedJson}</code>
            </pre>
          </div>

          {/* Chronological Transcript Accordion */}
          <div className="space-y-2 pt-2 border-t border-aura-border">
            <h3 className="text-xs font-semibold text-aura-text-primary">
              Full Chronological Transcript ({transcript.length} turns)
            </h3>
            <div className="max-h-56 overflow-y-auto space-y-2.5 p-3 rounded-xl bg-aura-bg/50 border border-aura-border">
              {transcript.map((t) => (
                <div key={t.id} className="text-xs leading-relaxed">
                  <span className="font-semibold text-aura-text-primary">
                    [{t.timestamp}] {t.speaker}:
                  </span>{" "}
                  <span className="text-aura-text-secondary">{t.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
