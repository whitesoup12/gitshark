import React, { useEffect, useState, useRef } from "react";
import { useSharkStore, SHARK_WISDOM_QUOTES } from "@/store/useSharkStore";
import { X, Sparkles, RefreshCw, Waves, Copy, Check } from "lucide-react";

/**
 * Stylized Neon Predator Shark SVG with Glowing Commit DAG Spine
 */
export const SwimmingSharkSvg: React.FC<{
  className?: string;
  size?: number;
  glowColor?: string;
}> = ({ className = "", size = 160, glowColor = "#38bdf8" }) => {
  return (
    <svg
      width={size}
      height={size * 0.42}
      viewBox="0 0 240 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} overflow-visible drop-shadow-[0_4px_16px_rgba(14,165,233,0.5)]`}
    >
      <defs>
        <linearGradient id="sharkBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="40%" stopColor="#0284c7" />
          <stop offset="85%" stopColor="#034870" />
          <stop offset="100%" stopColor="#022740" />
        </linearGradient>
        <linearGradient id="sharkBellyGrad" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#0369a1" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="spineDagGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <filter id="sharkGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Tail Fin (Caudal) */}
      <path
        d="M 28 50 C 15 28, 5 12, 0 10 C 6 28, 14 44, 20 50 C 14 56, 6 72, 0 90 C 5 88, 15 72, 28 50 Z"
        fill="url(#sharkBodyGrad)"
      />

      {/* Main Torpedo Body */}
      <path
        d="M 24 50 C 55 42, 110 32, 175 36 C 215 39, 236 48, 240 50 C 236 52, 215 62, 175 66 C 110 70, 55 58, 24 50 Z"
        fill="url(#sharkBodyGrad)"
      />

      {/* Dorsal Fin */}
      <path
        d="M 115 34 C 130 18, 145 2, 158 0 C 152 14, 148 24, 155 35 Z"
        fill="url(#sharkBodyGrad)"
        stroke={glowColor}
        strokeWidth="1.2"
      />

      {/* Pectoral Fin */}
      <path
        d="M 130 63 C 120 78, 105 94, 95 98 C 108 92, 126 80, 145 64 Z"
        fill="url(#sharkBodyGrad)"
        opacity="0.9"
      />

      {/* Ventral White Belly Accent */}
      <path
        d="M 60 52 C 100 58, 160 58, 205 52 C 170 62, 110 63, 60 52 Z"
        fill="url(#sharkBellyGrad)"
      />

      {/* Shark Eye (Glowing Cyan Node) */}
      <circle cx="218" cy="46" r="2.8" fill="#ffffff" filter="url(#sharkGlow)" />
      <circle cx="218" cy="46" r="1.4" fill="#0369a1" />

      {/* Gill Slits */}
      <path d="M 166 43 Q 164 50 166 57" stroke="#082f49" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 171 44 Q 169 50 171 56" stroke="#082f49" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 176 45 Q 174 50 176 55" stroke="#082f49" strokeWidth="1.5" strokeLinecap="round" />

      {/* Glowing Commit DAG spine along the body */}
      <g filter="url(#sharkGlow)">
        {/* Highway Line */}
        <path
          d="M 50 50 L 95 48 L 140 47 L 185 48"
          stroke="url(#spineDagGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="2 3"
        />
        {/* Branch up to Dorsal Fin */}
        <path
          d="M 125 47 L 145 18"
          stroke="#38bdf8"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Commit Nodes */}
        <circle cx="50" cy="50" r="3" fill="#34d399" />
        <circle cx="95" cy="48" r="3.5" fill="#38bdf8" />
        <circle cx="140" cy="47" r="3.5" fill="#818cf8" />
        <circle cx="185" cy="48" r="3" fill="#a78bfa" />
        <circle cx="145" cy="18" r="3" fill="#38bdf8" />
      </g>
    </svg>
  );
};

/**
 * SharkCelebrationOverlay - Handles swimming shark animations & Konami Code Easter Egg
 */
export const SharkCelebrationOverlay: React.FC = () => {
  const { activeCelebration, dismissCelebration, triggerCelebration } = useSharkStore();
  const [bubbles, setBubbles] = useState<{ id: number; left: number; bottom: number; size: number }[]>([]);
  const konamiSeq = useRef<string[]>([]);

  // Konami Code listener: Up, Up, Down, Down, Left, Right, Left, Right, b, a
  useEffect(() => {
    const targetCode = [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "b",
      "a",
    ];

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      konamiSeq.current.push(e.key);
      if (konamiSeq.current.length > targetCode.length) {
        konamiSeq.current.shift();
      }

      if (
        konamiSeq.current.length === targetCode.length &&
        konamiSeq.current.every((key, idx) => key.toLowerCase() === targetCode[idx].toLowerCase())
      ) {
        konamiSeq.current = [];
        triggerCelebration("frenzy", "🦈 MEGALODON SHARK FRENZY UNLOCKED! 🌊");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [triggerCelebration]);

  // Handle active celebration duration and spawning commit bubbles
  useEffect(() => {
    if (!activeCelebration) {
      setBubbles([]);
      return;
    }

    // Spawn bubbles in intervals while shark swims
    const interval = setInterval(() => {
      setBubbles((prev) => [
        ...prev.slice(-14),
        {
          id: Date.now() + Math.random(),
          left: Math.random() * 85 + 5,
          bottom: Math.random() * 25 + 15,
          size: Math.random() * 9 + 5,
        },
      ]);
    }, 280);

    // Auto-dismiss celebration after animation finishes
    const timer = setTimeout(() => {
      dismissCelebration();
    }, 4200);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [activeCelebration, dismissCelebration]);

  if (!activeCelebration) return null;

  const isFrenzy = activeCelebration.type === "frenzy";

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden select-none">
      {/* Floating Commit Bubbles */}
      {bubbles.map((b) => (
        <div
          key={b.id}
          style={{
            left: `${b.left}%`,
            bottom: `${b.bottom}px`,
            width: `${b.size}px`,
            height: `${b.size}px`,
          }}
          className="absolute rounded-full bg-sky-400/20 border border-sky-300/60 shadow-[0_0_8px_rgba(56,189,248,0.6)] animate-bubble-float flex items-center justify-center"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-teal-200/80" />
        </div>
      ))}

      {/* Celebration Notification Badge */}
      {activeCelebration.message && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-shark-900/90 border border-sky-500/50 shadow-2xl shadow-sky-950/80 text-sky-200 text-xs font-semibold backdrop-blur-md animate-bounce">
          <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-spin" />
          <span>{activeCelebration.message}</span>
        </div>
      )}

      {/* Primary Shark */}
      <div
        className="absolute bottom-8 left-0 animate-shark-swim"
        style={{ animationDuration: isFrenzy ? "3.2s" : "3.8s" }}
      >
        <SwimmingSharkSvg size={isFrenzy ? 210 : 180} />
      </div>

      {/* Frenzy Extra Sharks */}
      {isFrenzy && (
        <>
          <div
            className="absolute bottom-20 left-0 animate-shark-swim"
            style={{ animationDuration: "2.8s", animationDelay: "0.4s" }}
          >
            <SwimmingSharkSvg size={140} glowColor="#34d399" />
          </div>
          <div
            className="absolute bottom-3 left-0 animate-shark-swim"
            style={{ animationDuration: "3.5s", animationDelay: "0.2s" }}
          >
            <SwimmingSharkSvg size={160} glowColor="#a78bfa" />
          </div>
        </>
      )}
    </div>
  );
};

/**
 * SharkWisdomModal - Charming floating speech bubble with witty Git tips & oceanic wisdom
 */
export const SharkWisdomModal: React.FC = () => {
  const {
    isWisdomOpen,
    currentWisdomIndex,
    closeWisdom,
    nextWisdom,
    triggerCelebration,
  } = useSharkStore();

  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isWisdomOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeWisdom();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        closeWisdom();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isWisdomOpen, closeWisdom]);

  if (!isWisdomOpen) return null;

  const currentQuote = SHARK_WISDOM_QUOTES[currentWisdomIndex] || SHARK_WISDOM_QUOTES[0];

  const handleSwimAcross = () => {
    triggerCelebration("swim", "Swimming through the commit waters! 🦈");
    closeWisdom();
  };

  return (
    <div
      ref={modalRef}
      className="fixed top-11 left-3 z-50 w-80 sm:w-96 rounded-xl bg-shark-900 border border-sky-500/40 shadow-2xl shadow-sky-950/90 text-slate-200 overflow-hidden animate-fade-in select-none"
    >
      {/* Oceanic Header Accent */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-shark-950 via-sky-950/50 to-shark-950 border-b border-shark-800">
        <div className="flex items-center gap-2">
          <span className="text-base">🦈</span>
          <span className="text-xs font-bold bg-gradient-to-r from-sky-400 to-teal-300 bg-clip-text text-transparent">
            Shark Wisdom from the Deep
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-950 border border-sky-800/60 text-sky-400">
            #{currentWisdomIndex + 1}/{SHARK_WISDOM_QUOTES.length}
          </span>
        </div>
        <button
          onClick={closeWisdom}
          className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-shark-800 transition-colors"
          title="Close (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quote Body */}
      <div className="p-4 space-y-3">
        <div className="p-3 rounded-lg bg-shark-950 border border-shark-800/80 text-xs text-sky-100 font-medium leading-relaxed italic relative shadow-inner group">
          <div className="absolute top-1 left-2 text-sky-600/30 text-2xl font-serif select-none pointer-events-none">
            “
          </div>
          <p className="relative z-10 pl-2 pr-6">{currentQuote}</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(currentQuote);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="absolute top-2 right-2 p-1 text-slate-500 hover:text-sky-300 rounded transition-colors"
            title="Copy quote"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <button
            onClick={nextWisdom}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-shark-800 hover:bg-shark-750 text-slate-300 hover:text-slate-100 border border-shark-700 transition-colors text-[11px] font-medium"
            title="Next Wisdom Quote"
          >
            <RefreshCw className="w-3 h-3 text-sky-400" />
            <span>Another Tip</span>
          </button>

          <button
            onClick={handleSwimAcross}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/50 text-sky-300 hover:text-sky-200 transition-colors text-[11px] font-semibold shadow-sm"
            title="Launch a swimming shark across the screen"
          >
            <Waves className="w-3 h-3 text-sky-400" />
            <span>Swim Across! 🦈</span>
          </button>
        </div>
      </div>

      {/* Footer Hint */}
      <div className="px-3.5 py-1.5 bg-shark-950/70 border-t border-shark-800 text-[10px] text-slate-500 flex items-center justify-between">
        <span>Click logo anytime for new tips</span>
        <span className="font-mono text-slate-600">↑↑↓↓←→←→BA</span>
      </div>
    </div>
  );
};
