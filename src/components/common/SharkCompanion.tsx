import React, { useEffect, useState, useRef } from "react";
import {
  useSharkStore,
  SHARK_WISDOM_QUOTES,
  computeSharkRank,
  SHARK_RANKS,
} from "@/store/useSharkStore";
import {
  X,
  Sparkles,
  RefreshCw,
  Waves,
  Copy,
  Check,
  Trophy,
  Flame,
  HardDrive,
} from "lucide-react";

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
 * Animated Neon Shark Jaws SVG for "Chomp" celebrations (discarding changes, deleting branches/stashes)
 */
export const SharkChompJawsSvg: React.FC<{ glowColor?: string }> = ({
  glowColor = "#38bdf8",
}) => {
  return (
    <div className="relative flex flex-col items-center justify-center w-64 h-64 select-none">
      {/* Impact Hydro-Shockwave Ring */}
      <div
        className="absolute w-44 h-44 rounded-full border-2 border-sky-400/70 shadow-[0_0_32px_rgba(56,189,248,0.65)] animate-chomp-wave"
        style={{ borderColor: glowColor }}
      />

      {/* Upper Jaw */}
      <svg
        width="220"
        height="95"
        viewBox="0 0 220 95"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="animate-jaw-upper drop-shadow-[0_6px_18px_rgba(14,165,233,0.65)] z-10"
      >
        <defs>
          <linearGradient id="upperJawGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#022740" />
            <stop offset="65%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        {/* Upper Snout Arch */}
        <path
          d="M 16 70 C 26 16, 75 4, 110 4 C 145 4, 194 16, 204 70 C 175 56, 140 50, 110 50 C 80 50, 45 56, 16 70 Z"
          fill="url(#upperJawGrad)"
          stroke={glowColor}
          strokeWidth="2"
        />
        {/* Glowing Eyes */}
        <circle cx="48" cy="34" r="3.5" fill="#e0f2fe" />
        <circle cx="172" cy="34" r="3.5" fill="#e0f2fe" />
        {/* Upper Serrated Teeth Row */}
        <path
          d="M 28 65 L 38 88 L 48 61 L 60 90 L 72 58 L 85 92 L 98 56 L 110 93 L 122 56 L 135 92 L 148 58 L 160 90 L 172 61 L 182 88 L 192 65 Z"
          fill="#f0f9ff"
          stroke="#38bdf8"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>

      {/* Lower Jaw */}
      <svg
        width="200"
        height="85"
        viewBox="0 0 200 85"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="animate-jaw-lower drop-shadow-[0_-6px_18px_rgba(52,211,153,0.55)] z-10 -mt-3"
      >
        <defs>
          <linearGradient id="lowerJawGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#022740" />
            <stop offset="65%" stopColor="#0369a1" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        {/* Lower Teeth Row pointing up */}
        <path
          d="M 22 28 L 32 5 L 43 31 L 55 3 L 68 33 L 82 2 L 95 34 L 105 2 L 118 34 L 132 2 L 145 33 L 157 3 L 168 31 L 178 5 L 186 28 Z"
          fill="#f0f9ff"
          stroke="#34d399"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Lower Jaw Cartilage Arch */}
        <path
          d="M 12 22 C 42 36, 75 40, 100 40 C 125 40, 158 36, 188 22 C 174 64, 138 80, 100 80 C 62 80, 26 64, 12 22 Z"
          fill="url(#lowerJawGrad)"
          stroke="#34d399"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
};

/**
 * SharkCelebrationOverlay - Handles swimming shark, chomp jaws, & Konami Code Easter Egg
 */
export const SharkCelebrationOverlay: React.FC = () => {
  const { activeCelebration, dismissCelebration, triggerCelebration, stats } =
    useSharkStore();
  const [bubbles, setBubbles] = useState<
    { id: number; left: number; bottom: number; size: number }[]
  >([]);
  const konamiSeq = useRef<string[]>([]);
  const rankInfo = computeSharkRank(stats);

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
        konamiSeq.current.every(
          (key, idx) => key.toLowerCase() === targetCode[idx].toLowerCase()
        )
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

    const durationMs = activeCelebration.type === "chomp" ? 2500 : 4200;

    // Spawn bubbles in intervals while celebration plays
    const interval = setInterval(() => {
      setBubbles((prev) => [
        ...prev.slice(-14),
        {
          id: Date.now() + Math.random(),
          left:
            activeCelebration.type === "chomp"
              ? Math.random() * 30 + 35
              : Math.random() * 85 + 5,
          bottom:
            activeCelebration.type === "chomp"
              ? Math.random() * 160 + 180
              : Math.random() * 25 + 15,
          size: Math.random() * 9 + 5,
        },
      ]);
    }, 220);

    const timer = setTimeout(() => {
      dismissCelebration();
    }, durationMs);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [activeCelebration, dismissCelebration]);

  if (!activeCelebration) return null;

  const isFrenzy = activeCelebration.type === "frenzy";
  const isChomp = activeCelebration.type === "chomp";

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
        <div className="absolute top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-shark-900/95 border border-sky-500/50 shadow-2xl shadow-sky-950/80 text-sky-200 text-xs font-semibold backdrop-blur-md animate-bounce">
          <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-spin" />
          <span>{activeCelebration.message}</span>
        </div>
      )}

      {/* Chomp Jaws Center Overlay */}
      {isChomp ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <SharkChompJawsSvg glowColor={rankInfo.glowColor} />
        </div>
      ) : (
        <>
          {/* Primary Swimming Shark */}
          <div
            className="absolute bottom-8 left-0 animate-shark-swim"
            style={{ animationDuration: isFrenzy ? "3.2s" : "3.8s" }}
          >
            <SwimmingSharkSvg
              size={isFrenzy ? 210 : 180}
              glowColor={rankInfo.glowColor}
            />
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
        </>
      )}
    </div>
  );
};

/**
 * SharkWisdomModal - Floating companion hub with Shark Evolution Rank, Feeding Stats, & Git Wisdom
 */
export const SharkWisdomModal: React.FC = () => {
  const {
    isWisdomOpen,
    currentWisdomIndex,
    closeWisdom,
    nextWisdom,
    triggerCelebration,
    stats,
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

  const currentQuote =
    SHARK_WISDOM_QUOTES[currentWisdomIndex] || SHARK_WISDOM_QUOTES[0];
  const rank = computeSharkRank(stats);

  const handleSwimAcross = () => {
    triggerCelebration(
      "swim",
      `${rank.emoji} ${rank.title} patrolling the commit waters!`
    );
    closeWisdom();
  };

  const handleChompTest = () => {
    triggerCelebration("chomp", "CHOMP! Snapping through stale code! 🦈");
    closeWisdom();
  };

  return (
    <div
      ref={modalRef}
      className="fixed top-11 left-3 z-50 w-80 sm:w-[410px] rounded-xl bg-shark-900 border border-sky-500/40 shadow-2xl shadow-sky-950/90 text-slate-200 overflow-hidden animate-fade-in select-none"
    >
      {/* Oceanic Header Accent */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-shark-950 via-sky-950/50 to-shark-950 border-b border-shark-800">
        <div className="flex items-center gap-2">
          <span className="text-base">{rank.emoji}</span>
          <span className="text-xs font-bold bg-gradient-to-r from-sky-400 to-teal-300 bg-clip-text text-transparent">
            Shark Companion & Oceanic Telemetry
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-950 border border-sky-800/60 text-sky-400">
            Lv.{rank.level}
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

      {/* Body */}
      <div className="p-3.5 space-y-3">
        {/* Shark Rank & Evolution Progress Card */}
        <div className="p-3 rounded-lg bg-shark-950/90 border border-shark-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Current Apex Rank
                </div>
                <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <span>{rank.title}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${rank.badgeClass}`}
                  >
                    {rank.totalScore.toLocaleString()} XP
                  </span>
                </div>
              </div>
            </div>

            {rank.nextScore !== null ? (
              <div className="text-right">
                <div className="text-[10px] text-slate-500">Next Evolution</div>
                <div className="text-[11px] font-mono text-sky-400 font-semibold">
                  {(rank.nextScore - rank.totalScore).toLocaleString()} XP to{" "}
                  {SHARK_RANKS[rank.level]?.title}
                </div>
              </div>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/80 border border-purple-700/60 text-purple-300 font-semibold">
                MAX EVOLUTION
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 rounded-full bg-shark-850 overflow-hidden border border-shark-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-teal-400 to-indigo-400 transition-all duration-500"
              style={{ width: `${rank.progressPct}%` }}
            />
          </div>

          {/* 4 Feeding & XP Stat Counters */}
          <div className="grid grid-cols-4 gap-1.5 pt-0.5 text-center">
            <div
              className="p-1.5 rounded bg-shark-900/90 border border-shark-800/80"
              title="Commits created (+1 XP each)"
            >
              <div className="text-xs font-bold font-mono text-sky-300">
                {stats.commitsSwum}
              </div>
              <div className="text-[9px] text-slate-400 truncate">Commits</div>
              <div className="text-[8px] font-mono text-sky-400/80">+1 XP</div>
            </div>
            <div
              className="p-1.5 rounded bg-shark-900/90 border border-shark-800/80"
              title="Pushes to remote (+5 XP each)"
            >
              <div className="text-xs font-bold font-mono text-emerald-300">
                {stats.pushesLaunched}
              </div>
              <div className="text-[9px] text-slate-400 truncate">Pushes</div>
              <div className="text-[8px] font-mono text-emerald-400/80">+5 XP</div>
            </div>
            <div
              className="p-1.5 rounded bg-shark-900/90 border border-shark-800/80"
              title="Pull requests launched in GitShark (+10 XP each)"
            >
              <div className="text-xs font-bold font-mono text-purple-300">
                {stats.prsOpened ?? stats.mergesToMain ?? 0}
              </div>
              <div className="text-[9px] text-slate-400 truncate">New PRs</div>
              <div className="text-[8px] font-mono text-purple-400/80">+10 XP</div>
            </div>
            <div
              className="p-1.5 rounded bg-shark-900/90 border border-shark-800/80"
              title="Discarded files, deleted branches & dropped stashes chomped"
            >
              <div className="text-xs font-bold font-mono text-rose-300">
                {stats.changesChomped}
              </div>
              <div className="text-[9px] text-slate-400 truncate">Chomped</div>
              <div className="text-[8px] font-mono text-rose-400/80">🦈 Jaws</div>
            </div>
          </div>

          <div
            className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-0.5 truncate"
            title={`Persisted outside app directory at: ${stats.storagePath}`}
          >
            <HardDrive className="w-3 h-3 text-emerald-400/80 flex-shrink-0" />
            <span className="truncate">
              Saved in home profile:{" "}
              <code className="text-slate-400 font-mono">
                ~/.gitshark/shark_stats.json
              </code>
            </span>
          </div>
        </div>

        {/* Wisdom Quote Box */}
        <div className="p-3 rounded-lg bg-shark-950 border border-shark-800/80 text-xs text-sky-100 font-medium leading-relaxed italic relative shadow-inner group">
          <div className="flex items-center justify-between text-[10px] not-italic text-slate-500 mb-1">
            <span>Shark Wisdom from the Deep</span>
            <span className="font-mono">
              #{currentWisdomIndex + 1}/{SHARK_WISDOM_QUOTES.length}
            </span>
          </div>
          <p className="relative z-10 pr-6">“{currentQuote}”</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(currentQuote);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="absolute bottom-2.5 right-2 p-1 text-slate-500 hover:text-sky-300 rounded transition-colors"
            title="Copy quote"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-0.5 text-xs gap-1.5">
          <button
            onClick={nextWisdom}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-shark-800 hover:bg-shark-750 text-slate-300 hover:text-slate-100 border border-shark-700 transition-colors text-[11px] font-medium"
            title="Next Wisdom Quote"
          >
            <RefreshCw className="w-3 h-3 text-sky-400" />
            <span>Next Tip</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleChompTest}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 transition-colors text-[11px] font-semibold"
              title="Trigger Shark Chomp Jaws animation"
            >
              <Flame className="w-3 h-3 text-emerald-400" />
              <span>Chomp!</span>
            </button>

            <button
              onClick={handleSwimAcross}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/50 text-sky-300 hover:text-sky-200 transition-colors text-[11px] font-semibold shadow-sm"
              title="Launch a swimming shark across the screen"
            >
              <Waves className="w-3 h-3 text-sky-400" />
              <span>Swim! 🦈</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Hint */}
      <div className="px-3.5 py-1.5 bg-shark-950/70 border-t border-shark-800 text-[10px] text-slate-500 flex items-center justify-between">
        <span>Stats persist across updates & reinstalls</span>
        <span className="font-mono text-slate-600">↑↑↓↓←→←→BA</span>
      </div>
    </div>
  );
};
