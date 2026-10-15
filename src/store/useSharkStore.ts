import { create } from "zustand";

export interface SharkCelebration {
  id: string;
  type: "swim" | "frenzy" | "chomp";
  message?: string;
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

interface SharkStoreState {
  celebrationsEnabled: boolean;
  wisdomEnabled: boolean;
  isWisdomOpen: boolean;
  currentWisdomIndex: number;
  activeCelebration: SharkCelebration | null;

  setCelebrationsEnabled: (enabled: boolean) => void;
  setWisdomEnabled: (enabled: boolean) => void;
  openWisdom: (index?: number) => void;
  closeWisdom: () => void;
  nextWisdom: () => void;
  triggerCelebration: (type?: "swim" | "frenzy" | "chomp", message?: string) => void;
  dismissCelebration: () => void;
}

export const useSharkStore = create<SharkStoreState>((set, get) => {
  const savedCeleb = localStorage.getItem(STORAGE_CELEBRATIONS);
  const celebrationsEnabled = savedCeleb !== null ? savedCeleb === "true" : true;

  const savedWisdom = localStorage.getItem(STORAGE_WISDOM);
  const wisdomEnabled = savedWisdom !== null ? savedWisdom === "true" : true;

  return {
    celebrationsEnabled,
    wisdomEnabled,
    isWisdomOpen: false,
    currentWisdomIndex: Math.floor(Math.random() * SHARK_WISDOM_QUOTES.length),
    activeCelebration: null,

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
      const nextIdx = (get().currentWisdomIndex + 1) % SHARK_WISDOM_QUOTES.length;
      set({ currentWisdomIndex: nextIdx });
    },

    triggerCelebration: (type: "swim" | "frenzy" | "chomp" = "swim", message?: string) => {
      if (!get().celebrationsEnabled && type !== "frenzy") return;
      const id = `${Date.now()}-${Math.random()}`;
      set({ activeCelebration: { id, type, message } });
    },

    dismissCelebration: () => {
      set({ activeCelebration: null });
    },
  };
});
