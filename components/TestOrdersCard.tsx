"use client";

import React, { useState, useEffect } from "react";
import { Copy, Check, RotateCcw, PackageCheck, Truck, Clock, AlertCircle } from "lucide-react";
import { MockOrder } from "@/lib/types";

interface TestOrdersCardProps {
  onSelectPrompt?: (promptText: string) => void;
  isCallActive: boolean;
}

const SAMPLE_PROMPTS = [
  "I want to return it",
  "cancel my order",
  "Mera order ORD-101 kahan hai?",
  "I want to talk to a human",
  "Where is my order ORD-101?",
  "Cancel ORD-103",
  "I bought this 20 days ago and opened it, can I return it?",
  "Book me a flight to Goa",
];

export const TestOrdersCard: React.FC<TestOrdersCardProps> = ({
  onSelectPrompt,
  isCallActive,
}) => {
  const [orders, setOrders] = useState<MockOrder[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (e) {
      console.warn("Failed to fetch orders:", e);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } finally {
      setIsResetting(false);
    }
  };

  const getStatusBadge = (status: MockOrder["status"]) => {
    switch (status) {
      case "Out for Delivery":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-200">
            <Truck className="w-2.5 h-2.5" /> Out for Delivery
          </span>
        );
      case "Delivered":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
            <PackageCheck className="w-2.5 h-2.5" /> Delivered (14d ago)
          </span>
        );
      case "Processing":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium border border-purple-200">
            <Clock className="w-2.5 h-2.5" /> Processing
          </span>
        );
      case "Cancelled":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-medium border border-rose-200">
            <AlertCircle className="w-2.5 h-2.5" /> Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-aura-border shadow-soft p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-aura-border">
        <div>
          <h2 className="text-sm font-semibold text-aura-text-primary tracking-tight">
            Test Orders
          </h2>
          <p className="text-[11px] text-aura-text-secondary">
            Mock database in memory
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={isResetting}
          aria-label="Reset test orders"
          title="Reset orders to initial state"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-aura-text-secondary hover:text-aura-text-primary hover:bg-stone-100 transition-colors"
        >
          <RotateCcw className={`w-3 h-3 ${isResetting ? "animate-spin" : ""}`} />
          Reset
        </button>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {orders.map((o) => (
          <div
            key={o.order_id}
            className="p-3 rounded-xl border border-aura-border bg-aura-bg/40 hover:bg-aura-bg transition-colors space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-semibold text-xs text-aura-text-primary">
                  {o.order_id}
                </span>
                <button
                  onClick={() => handleCopy(o.order_id)}
                  title="Copy Order ID"
                  aria-label={`Copy ${o.order_id}`}
                  className="p-1 rounded text-aura-text-muted hover:text-aura-text-primary hover:bg-white transition-colors"
                >
                  {copiedId === o.order_id ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
              <div>{getStatusBadge(o.status)}</div>
            </div>

            <div className="text-xs text-aura-text-primary font-medium flex items-center justify-between">
              <span className="truncate pr-2">{o.product}</span>
              <span className="text-aura-text-secondary whitespace-nowrap">₹{o.value}</span>
            </div>

            <p className="text-[11px] text-aura-text-secondary leading-snug">
              {o.notes}
            </p>
          </div>
        ))}
      </div>

      {/* "Try saying" suggestions */}
      <div className="pt-2 border-t border-aura-border space-y-2">
        <h3 className="text-xs font-semibold text-aura-text-primary tracking-tight">
          Try saying (or click to send):
        </h3>
        <div className="flex flex-col gap-1.5">
          {SAMPLE_PROMPTS.map((promptText, idx) => (
            <button
              key={idx}
              onClick={() => onSelectPrompt?.(promptText)}
              className="text-left px-3 py-1.5 rounded-lg text-xs text-aura-text-secondary bg-aura-bg/60 hover:bg-aura-sage-light hover:text-aura-sage-hover transition-colors border border-transparent hover:border-aura-sage-soft group flex items-start justify-between"
            >
              <span className="leading-tight">&ldquo;{promptText}&rdquo;</span>
              {isCallActive && (
                <span className="opacity-0 group-hover:opacity-100 text-[10px] font-medium text-aura-sage-hover shrink-0 ml-1">
                  Ask →
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
