import { create } from "zustand";
import { getSharkStatsIpc, saveSharkStatsIpc } from "@/lib/ipc";

export interface SharkCelebration {
  id: string;
  type: "swim" | "frenzy" | "chomp";
  message?: string;
}

export interface SharkStats {
  commitsSwum: number;
  changesChomped: number;
  pushesLaunched: number;
  stashesBuried: number;
  mergesToMain: number;
  prsOpened: number;
  storagePath: string;
}

export const XP_PER_COMMIT = 1;
export const XP_PER_PUSH = 5;
export const XP_PER_NEW_PR = 10;
export const XP_PER_MAIN_MERGE = 10;

export interface SharkRankInfo {
  level: number;
  title: string;
  emoji: string;
  minScore: number;
  nextScore: number | null;
  totalScore: number;
  progressPct: number;
  glowColor: string;
  badgeClass: string;
}

export const SHARK_RANKS: {
  level: number;
  title: string;
  emoji: string;
  minScore: number;
  nextScore: number | null;
  glowColor: string;
  badgeClass: string;
}[] = [
  {
    level: 1,
    title: "Reef Pup",
    emoji: "🐟",
    minScore: 0,
    nextScore: 1000,
    glowColor: "#38bdf8",
    badgeClass: "bg-sky-950/70 text-sky-300 border-sky-700/50",
  },
  {
    level: 2,
    title: "Mako Sprinter",
    emoji: "⚡",
    minScore: 1000,
    nextScore: 3000,
    glowColor: "#34d399",
    badgeClass: "bg-emerald-950/70 text-emerald-300 border-emerald-700/50",
  },
  {
    level: 3,
    title: "Hammerhead Navigator",
    emoji: "🔨",
    minScore: 3000,
    nextScore: 9000,
    glowColor: "#fbbf24",
    badgeClass: "bg-amber-950/70 text-amber-300 border-amber-700/50",
  },
  {
    level: 4,
    title: "Great White Apex",
    emoji: "🦈",
    minScore: 9000,
    nextScore: 27000,
    glowColor: "#818cf8",
    badgeClass: "bg-indigo-950/70 text-indigo-300 border-indigo-700/50",
  },
  {
    level: 5,
    title: "Cyber Megalodon",
    emoji: "🌊",
    minScore: 27000,
    nextScore: null,
    glowColor: "#c084fc",
    badgeClass: "bg-purple-950/80 text-purple-300 border-purple-600/60",
  },
];

export function computeSharkRank(stats: SharkStats): SharkRankInfo {
  const prs = Math.max(stats.prsOpened || 0, stats.mergesToMain || 0);
  const totalScore =
    stats.commitsSwum * XP_PER_COMMIT +
    stats.pushesLaunched * XP_PER_PUSH +
    prs * XP_PER_NEW_PR;

  let current = SHARK_RANKS[0];
  for (const tier of SHARK_RANKS) {
    if (totalScore >= tier.minScore) {
      current = tier;
    }
  }

  let progressPct = 100;
  if (current.nextScore !== null) {
    const span = current.nextScore - current.minScore;
    const intoTier = totalScore - current.minScore;
    progressPct = Math.min(100, Math.max(0, Math.round((intoTier / span) * 100)));
  }

  return {
    ...current,
    totalScore,
    progressPct,
  };
}

export const SHARK_WISDOM_QUOTES = [
  "A commit a day keeps the merge conflicts away.",
  "Never force push to main without a lifeline.",
  "Dun dun... dun dun... dun-dun-dun-dun 🎶 Merge conflict detected in shallow waters!",
  "A shark never sleeps, and neither does git-fetch.",
  "Great White Advice: When lost in git history, 'git reflog' is your echolocation.",
  "Fast-forward merge: Swimming with the current without making waves.",
  "Hammerhead Tip: 360-degree vision is great, but GitShark's DAG canvas is even clearer.",
  "You're gonna need a bigger boat... or git-lfs.",
  "Fish are friends, not unstaged merge conflicts.",
  "Megalodon Wisdom: Squash your commits before they squash your pull request review.",
  "Smooth seas never made a skilled sailor, but clean git hygiene certainly helps.",
  "Branch out, don't get beached!",
  "Sharks have rows of replaceable teeth; git has rows of immutable commits.",
  "Cherry-pick with care: Not all seashells belong in your bucket.",
  "Stash your changes like a tiger shark stashing treasure in deep waters.",
  "When working trees get messy, even a shark appreciates a clean commit.",
  "Keep your repository lean, or you'll swim slower than a sea turtle.",
  "Dorsal fin high, head held higher: Your branch is 1 commit ahead of main!",
];

const STORAGE_CELEBRATIONS = "gitshark_celebrations_enabled";
const STORAGE_WISDOM = "gitshark_wisdom_enabled";
const STORAGE_STATS = "gitshark_feeding_stats";

function loadLocalStats(): SharkStats {
  try {
    const raw = localStorage.getItem(STORAGE_STATS);
    if (raw) {
      const parsed = JSON.parse(raw);
      const prs = Math.max(Number(parsed.prsOpened) || 0, Number(parsed.mergesToMain) || 0);
      return {
        commitsSwum: Number(parsed.commitsSwum) || 0,
        changesChomped: Number(parsed.changesChomped) || 0,
        pushesLaunched: Number(parsed.pushesLaunched) || 0,
        stashesBuried: Number(parsed.stashesBuried) || 0,
        mergesToMain: prs,
        prsOpened: prs,
        storagePath: parsed.storagePath || "~/.gitshark/shark_stats.json",
      };
    }
  } catch {
    // ignore parse errors
  }
  return {
    commitsSwum: 0,
    changesChomped: 0,
    pushesLaunched: 0,
    stashesBuried: 0,
    mergesToMain: 0,
    prsOpened: 0,
    storagePath: "~/.gitshark/shark_stats.json",
  };
}

function saveLocalStats(stats: SharkStats) {
  try {
    localStorage.setItem(STORAGE_STATS, JSON.stringify(stats));
  } catch {
    // ignore storage quota errors
  }
}

interface SharkStoreState {
  celebrationsEnabled: boolean;
  wisdomEnabled: boolean;
  isWisdomOpen: boolean;
  currentWisdomIndex: number;
  activeCelebration: SharkCelebration | null;
  stats: SharkStats;

  initSharkStats: () => Promise<void>;
  recordSharkStat: (
    kind: "commit" | "chomp" | "push" | "stash" | "pr" | "main_merge",
    amount?: number
  ) => void;
  setCelebrationsEnabled: (enabled: boolean) => void;
  setWisdomEnabled: (enabled: boolean) => void;
  openWisdom: (index?: number) => void;
  closeWisdom: () => void;
  nextWisdom: () => void;
  triggerCelebration: (
    type?: "swim" | "frenzy" | "chomp",
    message?: string
  ) => void;
  dismissCelebration: () => void;
}

export const useSharkStore = create<SharkStoreState>((set, get) => {
  const savedCeleb = localStorage.getItem(STORAGE_CELEBRATIONS);
  const celebrationsEnabled = savedCeleb !== null ? savedCeleb === "true" : true;

  const savedWisdom = localStorage.getItem(STORAGE_WISDOM);
  const wisdomEnabled = savedWisdom !== null ? savedWisdom === "true" : true;

  const initialStats = loadLocalStats();

  return {
    celebrationsEnabled,
    wisdomEnabled,
    isWisdomOpen: false,
    currentWisdomIndex: Math.floor(Math.random() * SHARK_WISDOM_QUOTES.length),
    activeCelebration: null,
    stats: initialStats,

    initSharkStats: async () => {
      try {
        const diskStats = await getSharkStatsIpc();
        const local = get().stats;

        const prs = Math.max(
          local.prsOpened || 0,
          local.mergesToMain || 0,
          diskStats.prs_opened || 0,
          diskStats.merges_to_main || 0
        );

        // Merge disk ~/.gitshark/shark_stats.json with localStorage using Math.max
        // so stats survive app reinstalls, portable folder moves, or cache clears
        const merged: SharkStats = {
          commitsSwum: Math.max(local.commitsSwum, diskStats.commits_swum || 0),
          changesChomped: Math.max(
            local.changesChomped,
            diskStats.changes_chomped || 0
          ),
          pushesLaunched: Math.max(
            local.pushesLaunched,
            diskStats.pushes_launched || 0
          ),
          stashesBuried: Math.max(
            local.stashesBuried,
            diskStats.stashes_buried || 0
          ),
          mergesToMain: prs,
          prsOpened: prs,
          storagePath:
            diskStats.storage_path ||
            local.storagePath ||
            "~/.gitshark/shark_stats.json",
        };

        saveLocalStats(merged);
        set({ stats: merged });

        // Persist merged stats back to ~/.gitshark/shark_stats.json
        await saveSharkStatsIpc({
          commits_swum: merged.commitsSwum,
          changes_chomped: merged.changesChomped,
          pushes_launched: merged.pushesLaunched,
          stashes_buried: merged.stashesBuried,
          merges_to_main: merged.mergesToMain,
          prs_opened: merged.prsOpened,
          storage_path: merged.storagePath,
        });
      } catch (err) {
        console.warn("Failed to sync shark stats from user home directory:", err);
      }
    },

    recordSharkStat: (
      kind: "commit" | "chomp" | "push" | "stash" | "pr" | "main_merge",
      amount = 1
    ) => {
      const prevStats = get().stats;
      const prevRank = computeSharkRank(prevStats);

      const prevPrs = Math.max(prevStats.prsOpened || 0, prevStats.mergesToMain || 0);
      const nextPrs = kind === "pr" || kind === "main_merge" ? prevPrs + amount : prevPrs;

      const nextStats: SharkStats = {
        ...prevStats,
        commitsSwum:
          kind === "commit" ? prevStats.commitsSwum + amount : prevStats.commitsSwum,
        changesChomped:
          kind === "chomp"
            ? prevStats.changesChomped + amount
            : prevStats.changesChomped,
        pushesLaunched:
          kind === "push"
            ? prevStats.pushesLaunched + amount
            : prevStats.pushesLaunched,
        stashesBuried:
          kind === "stash"
            ? prevStats.stashesBuried + amount
            : prevStats.stashesBuried,
        mergesToMain: nextPrs,
        prsOpened: nextPrs,
      };

      saveLocalStats(nextStats);
      set({ stats: nextStats });

      const nextRank = computeSharkRank(nextStats);
      if (nextRank.level > prevRank.level) {
        setTimeout(() => {
          get().triggerCelebration(
            nextRank.level >= 5 ? "frenzy" : "swim",
            `${nextRank.emoji} SHARK RANK UP: ${nextRank.title}!`
          );
        }, 250);
      }

      saveSharkStatsIpc({
        commits_swum: nextStats.commitsSwum,
        changes_chomped: nextStats.changesChomped,
        pushes_launched: nextStats.pushesLaunched,
        stashes_buried: nextStats.stashesBuried,
        merges_to_main: nextStats.mergesToMain,
        prs_opened: nextStats.prsOpened,
        storage_path: nextStats.storagePath,
      }).catch((err) => {
        console.warn("Failed to write shark stats to disk:", err);
      });
    },

    setCelebrationsEnabled: (enabled: boolean) => {
      localStorage.setItem(STORAGE_CELEBRATIONS, String(enabled));
      set({ celebrationsEnabled: enabled });
    },

    setWisdomEnabled: (enabled: boolean) => {
      localStorage.setItem(STORAGE_WISDOM, String(enabled));
      set({ wisdomEnabled: enabled });
    },

    openWisdom: (index?: number) => {
      if (!get().wisdomEnabled && index === undefined) return;
      const idx =
        index !== undefined
          ? index
          : Math.floor(Math.random() * SHARK_WISDOM_QUOTES.length);
      set({
        isWisdomOpen: true,
        currentWisdomIndex: idx,
      });
    },

    closeWisdom: () => {
      set({ isWisdomOpen: false });
    },

    nextWisdom: () => {
      const nextIdx =
        (get().currentWisdomIndex + 1) % SHARK_WISDOM_QUOTES.length;
      set({ currentWisdomIndex: nextIdx });
    },

    triggerCelebration: (
      type: "swim" | "frenzy" | "chomp" = "swim",
      message?: string
    ) => {
      if (!get().celebrationsEnabled && type !== "frenzy") return;
      const id = `${Date.now()}-${Math.random()}`;
      set({ activeCelebration: { id, type, message } });
    },

    dismissCelebration: () => {
      set({ activeCelebration: null });
    },
  };
});
