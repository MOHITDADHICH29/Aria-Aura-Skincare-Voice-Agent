import React from "react";
import { Sparkles } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <header className="w-full border-b border-aura-border bg-aura-surface/80 backdrop-blur-md sticky top-0 z-20">
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
