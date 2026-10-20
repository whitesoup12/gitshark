import { create } from "zustand";

export type PaletteCategory = "all" | "actions" | "branches" | "commits" | "files" | "repos";

interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  category: PaletteCategory;
  open: (options?: { query?: string; category?: PaletteCategory }) => void;
  close: () => void;
  toggle: (options?: { category?: PaletteCategory }) => void;
  setQuery: (query: string) => void;
  setCategory: (category: PaletteCategory) => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  isOpen: false,
  query: "",
  category: "all",

  open: (options) =>
    set({
      isOpen: true,
      query: options?.query ?? "",
      category: options?.category ?? "all",
    }),

  close: () =>
    set({
      isOpen: false,
      query: "",
      category: "all",
    }),

  toggle: (options) =>
    set((state) => ({
      isOpen: !state.isOpen,
      query: !state.isOpen ? "" : state.query,
      category: options?.category ?? (state.isOpen ? "all" : state.category),
    })),

  setQuery: (query) => set({ query }),
  setCategory: (category) => set({ category }),
}));
