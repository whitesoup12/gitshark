import type * as MonacoType from "monaco-editor";
import { emit, listen } from "@tauri-apps/api/event";
import type { ThemeId, ThemeDefinition } from "@/types";

export const THEME_STORAGE_KEY = "gitshark_theme";
export const THEME_EVENT_NAME = "gitshark:theme-changed";

export const THEMES: ThemeDefinition[] = [
  {
    id: "shark-dark",
    name: "Shark Dark",
    description: "Deep obsidian & oceanic cyan (GitShark Signature)",
    type: "dark",
    primaryBg: "#090d16",
    secondaryBg: "#141e34",
    accent: "#0ea5e9",
    text: "#f1f5f9",
    monacoTheme: "codeshark-shark-dark",
  },
  {
    id: "abyssal",
    name: "Abyssal Trench",
    description: "Midnight sapphire & bioluminescent aqua/teal",
    type: "dark",
    primaryBg: "#040711",
    secondaryBg: "#0c1833",
    accent: "#14b8a6",
    text: "#ccfbf1",
    monacoTheme: "codeshark-abyssal",
  },
  {
    id: "dracula",
    name: "Dracula",
    description: "Iconic slate-purple with pink & purple accents",
    type: "dark",
    primaryBg: "#1e1f29",
    secondaryBg: "#282a36",
    accent: "#ff79c6",
    text: "#f8f8f2",
    monacoTheme: "codeshark-dracula",
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    description: "Twilight indigo with neon cyan & magenta",
    type: "dark",
    primaryBg: "#16161e",
    secondaryBg: "#1f2335",
    accent: "#7dcfff",
    text: "#c0caf5",
    monacoTheme: "codeshark-tokyo-night",
  },
  {
    id: "nord",
    name: "Nordic Frost",
    description: "Arctic polar night with glacial frost blues",
    type: "dark",
    primaryBg: "#242933",
    secondaryBg: "#2e3440",
    accent: "#88c0d0",
    text: "#eceff4",
    monacoTheme: "codeshark-nord",
  },
  {
    id: "one-dark",
    name: "One Dark Pro",
    description: "Atom dark slate with amber & sky blue",
    type: "dark",
    primaryBg: "#1e1e24",
    secondaryBg: "#282c34",
    accent: "#61afef",
    text: "#abb2bf",
    monacoTheme: "codeshark-one-dark",
  },
  {
    id: "daylight-reef",
    name: "Daylight Reef",
    description: "Crisp daytime light mode with ocean blue accents",
    type: "light",
    primaryBg: "#f8fafc",
    secondaryBg: "#e2e8f0",
    accent: "#0284c7",
    text: "#0f172a",
    monacoTheme: "codeshark-daylight-reef",
  },
];

export function getSavedTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (saved && THEMES.some((t) => t.id === saved)) {
      return saved;
    }
  } catch {
    // ignore
  }
  return "shark-dark";
}

export function saveTheme(themeId: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    // ignore
  }
}

export function applyTheme(themeId: ThemeId): void {
  saveTheme(themeId);
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];

  const root = document.documentElement;
  root.setAttribute("data-theme", theme.id);

  if (theme.type === "light") {
    root.classList.remove("dark");
  } else {
    root.classList.add("dark");
  }

  // Dispatch custom event so any listeners (like Monaco Editor instances) update
  window.dispatchEvent(
    new CustomEvent("gitshark-theme-changed", { detail: { themeId: theme.id, monacoTheme: theme.monacoTheme } })
  );
}

/**
 * Broadcasts theme changes to all running Tauri windows (GitShark main window and CodeShark window)
 */
export async function broadcastThemeChange(themeId: ThemeId): Promise<void> {
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  if (isTauri) {
    try {
      await emit(THEME_EVENT_NAME, { themeId });
    } catch (err) {
      console.warn("Failed to broadcast theme change via Tauri event:", err);
    }
  }
}

/**
 * Listens for theme changes broadcast across windows via Tauri IPC events and Web Storage events.
 * Returns an unlisten cleanup function.
 */
export function setupCrossWindowThemeSync(onThemeChange: (themeId: ThemeId) => void): () => void {
  if (typeof window === "undefined") return () => {};

  let isCleanedUp = false;
  let unlistenTauri: (() => void) | null = null;

  // 1. Listen for cross-window Tauri events
  const isTauri = "__TAURI_INTERNALS__" in window;
  if (isTauri) {
    listen<{ themeId: ThemeId }>(THEME_EVENT_NAME, (event) => {
      const newTheme = event.payload?.themeId;
      if (newTheme && THEMES.some((t) => t.id === newTheme)) {
        onThemeChange(newTheme);
      }
    })
      .then((unlisten) => {
        if (isCleanedUp) {
          unlisten();
        } else {
          unlistenTauri = unlisten;
        }
      })
      .catch((err) => {
        console.warn("Failed to register Tauri theme sync listener:", err);
      });
  }

  // 2. Cross-window sync via storage event (fires in other windows/tabs sharing the same storage origin)
  const handleStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY && e.newValue) {
      const newTheme = e.newValue as ThemeId;
      if (THEMES.some((t) => t.id === newTheme)) {
        onThemeChange(newTheme);
      }
    }
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    isCleanedUp = true;
    window.removeEventListener("storage", handleStorage);
    if (unlistenTauri) {
      unlistenTauri();
    }
  };
}

let themesRegistered = false;

export function registerMonacoThemes(monacoInstance: typeof MonacoType): void {
  if (themesRegistered) return;
  themesRegistered = true;

  // 1. Shark Dark
  monacoInstance.editor.defineTheme("codeshark-shark-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "64748b", fontStyle: "italic" },
      { token: "keyword", foreground: "38bdf8", fontStyle: "bold" },
      { token: "string", foreground: "34d399" },
      { token: "number", foreground: "fbbf24" },
      { token: "type", foreground: "22d3ee" },
      { token: "function", foreground: "60a5fa" },
      { token: "variable", foreground: "f1f5f9" },
    ],
    colors: {
      "editor.background": "#090d16",
      "editor.foreground": "#f1f5f9",
      "editorCursor.foreground": "#06b6d4",
      "editor.lineHighlightBackground": "#0f172a",
      "editorLineNumber.foreground": "#475569",
      "editorLineNumber.activeForeground": "#38bdf8",
      "editor.selectionBackground": "#0e749066",
      "editor.inactiveSelectionBackground": "#0e749033",
    },
  });

  // 2. Abyssal Trench
  monacoInstance.editor.defineTheme("codeshark-abyssal", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "527883", fontStyle: "italic" },
      { token: "keyword", foreground: "2dd4bf", fontStyle: "bold" },
      { token: "string", foreground: "6ee7b7" },
      { token: "number", foreground: "fcd34d" },
      { token: "type", foreground: "5eead4" },
      { token: "function", foreground: "38bdf8" },
      { token: "variable", foreground: "ccfbf1" },
    ],
    colors: {
      "editor.background": "#040711",
      "editor.foreground": "#ccfbf1",
      "editorCursor.foreground": "#14b8a6",
      "editor.lineHighlightBackground": "#081022",
      "editorLineNumber.foreground": "#334155",
      "editorLineNumber.activeForeground": "#2dd4bf",
      "editor.selectionBackground": "#0f766e66",
      "editor.inactiveSelectionBackground": "#0f766e33",
    },
  });

  // 3. Dracula
  monacoInstance.editor.defineTheme("codeshark-dracula", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6272a4", fontStyle: "italic" },
      { token: "keyword", foreground: "ff79c6", fontStyle: "bold" },
      { token: "string", foreground: "f1fa8c" },
      { token: "number", foreground: "bd93f9" },
      { token: "type", foreground: "8be9fd", fontStyle: "italic" },
      { token: "function", foreground: "50fa7b" },
      { token: "variable", foreground: "f8f8f2" },
    ],
    colors: {
      "editor.background": "#1e1f29",
      "editor.foreground": "#f8f8f2",
      "editorCursor.foreground": "#ff79c6",
      "editor.lineHighlightBackground": "#282a36",
      "editorLineNumber.foreground": "#6272a4",
      "editorLineNumber.activeForeground": "#ff79c6",
      "editor.selectionBackground": "#44475a",
      "editor.inactiveSelectionBackground": "#44475a80",
    },
  });

  // 4. Tokyo Night
  monacoInstance.editor.defineTheme("codeshark-tokyo-night", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "565f89", fontStyle: "italic" },
      { token: "keyword", foreground: "bb9af7", fontStyle: "bold" },
      { token: "string", foreground: "9ece6a" },
      { token: "number", foreground: "ff9e64" },
      { token: "type", foreground: "2ac3de" },
      { token: "function", foreground: "7aa2f7" },
      { token: "variable", foreground: "c0caf5" },
    ],
    colors: {
      "editor.background": "#16161e",
      "editor.foreground": "#c0caf5",
      "editorCursor.foreground": "#7dcfff",
      "editor.lineHighlightBackground": "#1f2335",
      "editorLineNumber.foreground": "#414868",
      "editorLineNumber.activeForeground": "#7dcfff",
      "editor.selectionBackground": "#283457",
      "editor.inactiveSelectionBackground": "#28345780",
    },
  });

  // 5. Nordic Frost
  monacoInstance.editor.defineTheme("codeshark-nord", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "616e88", fontStyle: "italic" },
      { token: "keyword", foreground: "81a1c1", fontStyle: "bold" },
      { token: "string", foreground: "a3be8c" },
      { token: "number", foreground: "b48ead" },
      { token: "type", foreground: "8fbcbb" },
      { token: "function", foreground: "88c0d0" },
      { token: "variable", foreground: "d8dee9" },
    ],
    colors: {
      "editor.background": "#242933",
      "editor.foreground": "#eceff4",
      "editorCursor.foreground": "#88c0d0",
      "editor.lineHighlightBackground": "#2e3440",
      "editorLineNumber.foreground": "#4c566a",
      "editorLineNumber.activeForeground": "#88c0d0",
      "editor.selectionBackground": "#434c5e",
      "editor.inactiveSelectionBackground": "#434c5e80",
    },
  });

  // 6. One Dark Pro
  monacoInstance.editor.defineTheme("codeshark-one-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "5c6370", fontStyle: "italic" },
      { token: "keyword", foreground: "c678dd", fontStyle: "bold" },
      { token: "string", foreground: "98c379" },
      { token: "number", foreground: "d19a66" },
      { token: "type", foreground: "e5c07b" },
      { token: "function", foreground: "61afef" },
      { token: "variable", foreground: "abb2bf" },
    ],
    colors: {
      "editor.background": "#1e1e24",
      "editor.foreground": "#abb2bf",
      "editorCursor.foreground": "#61afef",
      "editor.lineHighlightBackground": "#282c34",
      "editorLineNumber.foreground": "#4b5263",
      "editorLineNumber.activeForeground": "#61afef",
      "editor.selectionBackground": "#3e4451",
      "editor.inactiveSelectionBackground": "#3e445180",
    },
  });

  // 7. Daylight Reef
  monacoInstance.editor.defineTheme("codeshark-daylight-reef", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "64748b", fontStyle: "italic" },
      { token: "keyword", foreground: "0284c7", fontStyle: "bold" },
      { token: "string", foreground: "0d9488" },
      { token: "number", foreground: "ea580c" },
      { token: "type", foreground: "0891b2" },
      { token: "function", foreground: "2563eb" },
      { token: "variable", foreground: "0f172a" },
    ],
    colors: {
      "editor.background": "#f8fafc",
      "editor.foreground": "#0f172a",
      "editorCursor.foreground": "#0284c7",
      "editor.lineHighlightBackground": "#f1f5f9",
      "editorLineNumber.foreground": "#94a3b8",
      "editorLineNumber.activeForeground": "#0284c7",
      "editor.selectionBackground": "#bae6fd",
      "editor.inactiveSelectionBackground": "#e0f2fe",
    },
  });
}
