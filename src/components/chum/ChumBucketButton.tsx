import React, { useRef } from "react";
import { useChumStore } from "@/store/useChumStore";

export const ChumBucketButton: React.FC = () => {
  const { isBucketTilting, triggerBucketDump } = useChumStore();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const originX = rect.left + rect.width / 2;
      const originY = rect.bottom;
      triggerBucketDump(originX, originY);
    } else {
      triggerBucketDump(window.innerWidth / 2, 40);
    }
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      className={`group relative flex items-center justify-center w-8 h-7 rounded-md bg-shark-900/90 hover:bg-shark-850 border border-shark-800 hover:border-red-500/50 transition-all shadow-sm cursor-pointer select-none ${
        isBucketTilting ? "scale-95" : "hover:scale-105 active:scale-95"
      }`}
      title="Chum Bucket: Click to dump chum and feed the sharks! 🦈🥩"
      aria-label="Dump Chum Bucket"
    >
      {/* Chum Scent Wave Ripple Pulse on Hover */}
      <div className="absolute inset-0 rounded-md bg-red-500/0 group-hover:bg-red-500/10 transition-colors pointer-events-none" />

      {/* SVG Chum Bucket */}
      <div
        className={`transition-transform duration-300 origin-bottom-left ${
          isBucketTilting ? "-rotate-45 translate-y-0.5" : "group-hover:-rotate-12"
        }`}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible drop-shadow-[0_2px_4px_rgba(239,68,68,0.3)]"
        >
          {/* Wire Handle */}
          <path
            d="M 5 9 C 5 3, 19 3, 19 9"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Bucket Body Trapezoid */}
          <path
            d="M 5 8 L 7 21 C 7.2 22, 16.8 22, 17 21 L 19 8 Z"
            fill="url(#bucketMetalGrad)"
            stroke="#475569"
            strokeWidth="1"
          />

          {/* Lower Reinforcing Steel Band */}
          <path
            d="M 6.4 16 C 9 17.5, 15 17.5, 17.6 16"
            stroke="#64748b"
            strokeWidth="1.2"
            fill="none"
          />

          {/* Upper Rim Oval */}
          <ellipse cx="12" cy="8" rx="7" ry="2.2" fill="#334155" stroke="#64748b" strokeWidth="1" />

          {/* Heaping Chum (Bloody meat & fish bits) */}
          <path
            d="M 7 8 C 8 5.5, 11 5, 12 6 C 13.5 4.5, 16 5.5, 17 8 C 15 8.5, 9 8.5, 7 8 Z"
            fill="url(#chumMeatGrad)"
          />

          {/* Tiny glowing chum chunks on top */}
          <circle cx="10" cy="6.5" r="1.2" fill="#f87171" />
          <circle cx="13.5" cy="5.8" r="1.4" fill="#fb7185" />
          <circle cx="15.5" cy="7.2" r="1" fill="#ef4444" />

          {/* Drip droplet when tilting */}
          {isBucketTilting && (
            <circle
              cx="5"
              cy="12"
              r="1.8"
              fill="#ef4444"
              className="animate-ping"
            />
          )}

          <defs>
            <linearGradient id="bucketMetalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="50%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="chumMeatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="60%" stopColor="#be123c" />
              <stop offset="100%" stopColor="#881337" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Splash Sparkle on Tilt */}
      {isBucketTilting && (
        <span className="absolute -bottom-2 -left-1 text-[10px] animate-bounce pointer-events-none">
          🥩
        </span>
      )}
    </button>
  );
};
