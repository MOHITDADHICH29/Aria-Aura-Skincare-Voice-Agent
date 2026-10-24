"use client";

import React, { useState } from "react";
import { Send } from "lucide-react";

interface FallbackInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  isCallActive: boolean;
}

export const FallbackInput: React.FC<FallbackInputProps> = ({
  onSend,
  disabled,
  isCallActive,
}) => {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText("");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full flex items-center gap-2 mt-3"
    >
      <div className="relative flex-1">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled || !isCallActive}
          placeholder={
            !isCallActive
              ? "Start the call above to speak or type…"
              : "Can't use the mic? Type your query here…"
          }
          className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl bg-white border border-aura-border text-aura-text-primary placeholder:text-aura-text-muted focus:outline-none focus:ring-2 focus:ring-aura-sage focus:border-transparent transition-all disabled:bg-stone-50 disabled:cursor-not-allowed"
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !isCallActive || !text.trim()}
        aria-label="Send text query"
        className="px-4 py-2.5 rounded-xl bg-aura-sage text-white text-xs sm:text-sm font-medium hover:bg-aura-sage-hover disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shadow-sm"
      >
        <span>Send</span>
        <Send className="w-3.5 h-3.5" />
      </button>
    </form>
  );
};
