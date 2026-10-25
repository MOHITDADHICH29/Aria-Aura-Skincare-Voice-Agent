import React from "react";
import { Sparkles } from "lucide-react";

export const Header: React.FC<{ headphoneMode?: boolean; toggleHeadphoneMode?: () => void }> = ({ headphoneMode = false, toggleHeadphoneMode = () => {} }) => {
  return (
    <header className="w-full bg-aura-bg/95 backdrop-blur-md sticky top-0 z-30 border-b border-aura-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand logo & wordmark */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-aura-sage-light flex items-center justify-center text-aura-sage-hover">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-aura-text-primary tracking-tight text-base sm:text-lg">
                Aura Skincare
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-aura-sage-light text-aura-sage-hover font-medium">
                Live Support
              </span>
            </div>
          {/* Headphone Mode Toggle */}
          <button onClick={toggleHeadphoneMode} className="flex items-center gap-1 px-2 py-1 rounded bg-aura-sage-light text-aura-sage-hover text-xs font-medium hover:bg-aura-sage-hover hover:text-white transition-colors">
            {headphoneMode ? "Full‑Duplex" : "Half‑Duplex"}
          </button>
          </div>
        </div>

        {/* Agent identifier */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs sm:text-sm font-medium text-aura-text-secondary">
            Aria · Voice Specialist (en-IN)
          </span>
        </div>
      </div>
    </header>
  );
};
