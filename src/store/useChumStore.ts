import { create } from "zustand";
import { useSharkStore } from "@/store/useSharkStore";

export interface ChumPiece {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  type: "fish" | "steak" | "shrimp" | "squid" | "bone" | "drop";
  size: number;
  eaten: boolean;
  opacity: number;
  wobbleOffset: number;
  driftX: number;
  wobbleSpeed: number;
  terminalVy: number;
  gravity: number;
}

export interface FrenzyShark {
  id: string;
  x: number;
  y: number;
  angle: number;
  targetAngle: number;
  speed: number;
  maxSpeed: number;
  size: number;
  glowColor: string;
  chompAnim: number; // 0 when not chomping, countdown when chomping
  targetChumId: string | null;
  state: "hunting" | "eating" | "departing";
  swimPhase?: number;
  turnSpeed?: number;
  separationWeight?: number;
}

export interface ChompParticle {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  type: "bubble" | "splash" | "wave";
}

interface ChumState {
  isActive: boolean;
  isBucketTilting: boolean;
  chumPieces: ChumPiece[];
  sharks: FrenzyShark[];
  chompParticles: ChompParticle[];
  frenzyCount: number;
  totalChompedInSession: number;

  // Actions
  triggerBucketDump: (originX: number, originY: number) => void;
  setBucketTilting: (tilting: boolean) => void;
  updateFrenzyState: (updater: (state: ChumState) => Partial<ChumState>) => void;
  dismissFrenzy: () => void;
}

const CHUM_TYPES: ChumPiece["type"][] = ["fish", "steak", "shrimp", "squid", "bone", "drop"];
const SHARK_COLORS = ["#38bdf8", "#2dd4bf", "#fbbf24", "#818cf8", "#c084fc", "#34d399", "#f43f5e"];

export const useChumStore = create<ChumState>((set, get) => ({
  isActive: false,
  isBucketTilting: false,
  chumPieces: [],
  sharks: [],
  chompParticles: [],
  frenzyCount: 0,
  totalChompedInSession: 0,

  setBucketTilting: (tilting: boolean) => set({ isBucketTilting: tilting }),

  triggerBucketDump: (originX: number, originY: number) => {
    // 1. Tilt bucket animation
    set({ isBucketTilting: true });
    setTimeout(() => {
      set({ isBucketTilting: false });
    }, 700);

    const prevChum = get().chumPieces.filter((c) => !c.eaten && c.y < window.innerHeight + 100);

    // 2. Spawn 12 to 16 new chum pieces bursting outward in a wide dispersing fan
    const pieceCount = Math.floor(Math.random() * 5) + 12;
    const newPieces: ChumPiece[] = [];

    for (let i = 0; i < pieceCount; i++) {
      // Fan out across a wide arc: pieces spread far left, center, and far right
      const spreadRatio = (i / (pieceCount - 1) - 0.5) * 2; // -1 to +1
      const lateralSpread = spreadRatio * (Math.random() * 2.6 + 1.2); // wide left/right velocity

      // Highly varied vertical speeds: heavier chunks drop faster, lighter morsels flutter slowly
      const downwardSpeed = Math.random() * 1.6 + 0.3; // widely staggered initial velocity
      const terminalVy = Math.random() * 0.75 + 0.38; // staggered terminal sinking speed: 0.38 to 1.13 px/frame
      const gravity = Math.random() * 0.014 + 0.008; // staggered gravity per morsel

      // Continual outward ocean current drift as it sinks:
      const outwardDrift = (spreadRatio + (Math.random() - 0.5) * 0.4) * 0.8;

      newPieces.push({
        id: `chum_${Date.now()}_${i}_${Math.random()}`,
        x: originX + spreadRatio * 26 + (Math.random() - 0.5) * 12,
        y: originY + 8 + Math.random() * 16,
        vx: lateralSpread,
        vy: downwardSpeed,
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 3, // slow graceful tumble
        type: CHUM_TYPES[Math.floor(Math.random() * CHUM_TYPES.length)],
        size: Math.floor(Math.random() * 10) + 24,
        eaten: false,
        opacity: 1,
        wobbleOffset: Math.random() * Math.PI * 2,
        driftX: outwardDrift,
        wobbleSpeed: Math.random() * 0.0015 + 0.0015,
        terminalVy,
        gravity,
      });
    }

    set({
      isActive: true,
      chumPieces: [...prevChum, ...newPieces],
      frenzyCount: get().frenzyCount + 1,
    });

    // 3. Rare chance (< 1%, specifically 0.8% = 1 in 125 chance) to award 100 XP jackpot!
    const isJackpot = Math.random() < 0.008;
    if (isJackpot) {
      useSharkStore.getState().awardChumJackpot(100, "CHUM BUCKET JACKPOT! 🦈💰");
    }

    // 4. Delay the sharks by 2.0s so the chum has time to slowly float down before sharks emerge!
    setTimeout(() => {
      const liveChum = get().chumPieces.filter((c) => !c.eaten);
      if (liveChum.length === 0) return;

      const activeSharks = get().sharks;
      const targetSharkCount = Math.min(activeSharks.length + 3, 5);
      const newSharks: FrenzyShark[] = [...activeSharks];

      // If jackpot, add a glowing Golden Megalodon shark sweeping across!
      if (isJackpot && !newSharks.some((s) => s.id.startsWith("shark_gold"))) {
        newSharks.push({
          id: `shark_gold_${Date.now()}`,
          x: -260,
          y: window.innerHeight * 0.45,
          angle: 0.1,
          targetAngle: 0.1,
          speed: 2.8,
          maxSpeed: 4.5,
          size: 240,
          glowColor: "#ffd700",
          chompAnim: 0,
          targetChumId: null,
          state: "hunting",
          swimPhase: Math.random() * Math.PI * 2,
          turnSpeed: 0.042,
          separationWeight: 1.8,
        });
      }

      let spawnIndex = newSharks.length;
      while (newSharks.length < targetSharkCount) {
        // Alternate entrance sides (left vs right) and vary entry depths to encircle the chum cloud
        const fromLeft = spawnIndex % 2 === 0;
        const startX = fromLeft
          ? -220 - Math.random() * 80
          : window.innerWidth + 220 + Math.random() * 80;

        // Distribute vertical entry lanes (upper, mid, deep waters)
        const verticalSpread = spawnIndex / Math.max(1, targetSharkCount - 1);
        const startY =
          window.innerHeight * 0.18 +
          verticalSpread * window.innerHeight * 0.62 +
          (Math.random() - 0.5) * 60;

        // Inward attack angles with vertical tilt
        const verticalTilt = (Math.random() - 0.5) * 0.45;
        const initialAngle = fromLeft ? verticalTilt : Math.PI - verticalTilt;

        newSharks.push({
          id: `shark_${Date.now()}_${newSharks.length}_${Math.random()}`,
          x: startX,
          y: Math.max(80, Math.min(window.innerHeight - 80, startY)),
          angle: initialAngle,
          targetAngle: initialAngle,
          speed: Math.random() * 0.8 + 2.2, // varied cruising speed
          maxSpeed: Math.random() * 1.2 + 3.6, // varied top speed
          size: Math.floor(Math.random() * 50) + 140, // 140px to 190px
          glowColor: SHARK_COLORS[Math.floor(Math.random() * SHARK_COLORS.length)],
          chompAnim: 0,
          targetChumId: null,
          state: "hunting",
          swimPhase: Math.random() * Math.PI * 2,
          turnSpeed: Math.random() * 0.02 + 0.048,
          separationWeight: Math.random() * 0.4 + 1.3,
        });
        spawnIndex++;
      }

      set({ sharks: newSharks });
    }, 2000);
  },

  updateFrenzyState: (updater) => {
    set((state) => updater(state));
  },

  dismissFrenzy: () => {
    set({
      isActive: false,
      chumPieces: [],
      sharks: [],
      chompParticles: [],
    });
  },
}));
