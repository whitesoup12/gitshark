import { create } from "zustand";

interface BlameState {
  isOpen: boolean;
  repoId: string | null;
  tabId: string | null;
  filePath: string | null;
  activeView: "blame" | "history";
  openBlame: (
    repoId: string,
    filePath: string,
    tabId?: string,
    initialView?: "blame" | "history"
  ) => void;
  closeBlame: () => void;
  setActiveView: (view: "blame" | "history") => void;
}

export const useBlameStore = create<BlameState>((set) => ({
  isOpen: false,
  repoId: null,
  tabId: null,
  filePath: null,
  activeView: "blame",

  openBlame: (repoId, filePath, tabId, initialView = "blame") =>
    set({
      isOpen: true,
      repoId,
      filePath,
      tabId: tabId || null,
      activeView: initialView,
    }),

  closeBlame: () =>
    set({
      isOpen: false,
      repoId: null,
      tabId: null,
      filePath: null,
    }),

  setActiveView: (activeView) => set({ activeView }),
}));
