import { create } from "zustand";
import type { GitBinaryInfo, SettingsTab, PushTagsOption, ThemeId } from "@/types";
import {
  getGitBinaryInfoIpc,
  setCustomGitPathIpc,
  validateGitPathIpc,
  pickGitExecutable,
  setDiffDebounceDelayIpc,
  pickDirectory,
} from "@/lib/ipc";
import {
  applyTheme,
  getSavedTheme,
  broadcastThemeChange,
  setupCrossWindowThemeSync,
} from "@/lib/theme";

const STORAGE_CUSTOM_GIT_PATH = "gitshark_custom_git_path";
const STORAGE_DIFF_REFRESH_DELAY = "gitshark_diff_refresh_delay";
const STORAGE_DEV_DIRECTORY = "gitshark_dev_directory";
const STORAGE_PUSH_TAGS_OPTION = "gitshark_push_tags_option";

let crossWindowSyncRegistered = false;

interface SettingsState {
  isSettingsOpen: boolean;
  activeTab: SettingsTab;
  gitInfo: GitBinaryInfo | null;
  isLoadingGitInfo: boolean;
  customPathInput: string;
  isTestingPath: boolean;
  testResult: { valid: boolean; message: string } | null;
  saveMessage: { success: boolean; message: string } | null;
  diffRefreshDelayMs: number;
  devDirectory: string | null;
  pushTagsOption: PushTagsOption;
  currentTheme: ThemeId;

  // Actions
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  setActiveTab: (tab: SettingsTab) => void;
  setCustomPathInput: (input: string) => void;
  setDiffRefreshDelayMs: (delayMs: number) => Promise<void>;
  setDevDirectory: (path: string | null) => void;
  setPushTagsOption: (option: PushTagsOption) => void;
  setTheme: (theme: ThemeId, broadcast?: boolean) => void;
  browseForDevDirectory: () => Promise<string | null>;
  loadGitInfo: () => Promise<void>;
  browseForGitExecutable: () => Promise<void>;
  testPath: (path: string) => Promise<void>;
  saveGitPath: (customPath: string | null) => Promise<boolean>;
  resetToAutoDetected: () => Promise<boolean>;
  initSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isSettingsOpen: false,
  activeTab: "git",
  gitInfo: null,
  isLoadingGitInfo: false,
  customPathInput: "",
  isTestingPath: false,
  testResult: null,
  saveMessage: null,
  diffRefreshDelayMs: 1500,
  devDirectory: null,
  pushTagsOption: "follow-tags",
  currentTheme: getSavedTheme(),

  setTheme: (theme: ThemeId, broadcast = true) => {
    applyTheme(theme);
    set({ currentTheme: theme });
    if (broadcast) {
      broadcastThemeChange(theme);
    }
  },

  setDevDirectory: (path: string | null) => {
    const trimmed = path?.trim() || null;
    if (trimmed) {
      localStorage.setItem(STORAGE_DEV_DIRECTORY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_DEV_DIRECTORY);
    }
    set({ devDirectory: trimmed });
  },

  setPushTagsOption: (option: PushTagsOption) => {
    localStorage.setItem(STORAGE_PUSH_TAGS_OPTION, option);
    set({ pushTagsOption: option });
  },

  browseForDevDirectory: async () => {
    const picked = await pickDirectory("Select Development Directory");
    if (picked) {
      get().setDevDirectory(picked);
      return picked;
    }
    return null;
  },

  openSettings: (tab = "git") => {
    set({
      isSettingsOpen: true,
      activeTab: tab,
      testResult: null,
      saveMessage: null,
    });
    get().loadGitInfo();
  },

  closeSettings: () => {
    set({ isSettingsOpen: false, testResult: null, saveMessage: null });
  },

  setActiveTab: (tab: SettingsTab) => {
    set({ activeTab: tab, testResult: null, saveMessage: null });
  },

  setCustomPathInput: (input: string) => {
    set({ customPathInput: input, testResult: null, saveMessage: null });
  },

  setDiffRefreshDelayMs: async (delayMs: number) => {
    try {
      localStorage.setItem(STORAGE_DIFF_REFRESH_DELAY, delayMs.toString());
      set({ diffRefreshDelayMs: delayMs });
      await setDiffDebounceDelayIpc(delayMs);
    } catch (e) {
      console.warn("Failed to set diff refresh delay:", e);
    }
  },

  loadGitInfo: async () => {
    set({ isLoadingGitInfo: true });
    try {
      const info = await getGitBinaryInfoIpc();
      set({
        gitInfo: info,
        customPathInput: info.is_custom ? info.current_path : "",
        isLoadingGitInfo: false,
      });
    } catch (err) {
      console.error("Failed to fetch Git info:", err);
      set({ isLoadingGitInfo: false });
    }
  },

  browseForGitExecutable: async () => {
    const picked = await pickGitExecutable();
    if (picked) {
      set({ customPathInput: picked, testResult: null, saveMessage: null });
      await get().testPath(picked);
    }
  },

  testPath: async (path: string) => {
    const trimmed = path.trim();
    if (!trimmed) {
      set({
        testResult: {
          valid: false,
          message: "Please specify a path to the git executable",
        },
      });
      return;
    }

    set({ isTestingPath: true, testResult: null });
    try {
      const versionStr = await validateGitPathIpc(trimmed);
      set({
        isTestingPath: false,
        testResult: {
          valid: true,
          message: `Found: ${versionStr}`,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({
        isTestingPath: false,
        testResult: {
          valid: false,
          message: `Validation failed: ${msg}`,
        },
      });
    }
  },

  saveGitPath: async (customPath: string | null) => {
    try {
      const pathArg = customPath?.trim() || null;
      await setCustomGitPathIpc(pathArg);

      if (pathArg) {
        localStorage.setItem(STORAGE_CUSTOM_GIT_PATH, pathArg);
      } else {
        localStorage.removeItem(STORAGE_CUSTOM_GIT_PATH);
      }

      await get().loadGitInfo();
      set({
        saveMessage: {
          success: true,
          message: pathArg
            ? "Custom Git path applied successfully"
            : "Reset to auto-detected Git binary",
        },
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({
        saveMessage: {
          success: false,
          message: `Failed to set Git path: ${msg}`,
        },
      });
      return false;
    }
  },

  resetToAutoDetected: async () => {
    return await get().saveGitPath(null);
  },

  initSettings: async () => {
    try {
      // Initialize active theme
      const savedTheme = getSavedTheme();
      applyTheme(savedTheme);
      set({ currentTheme: savedTheme });

      // Initialize cross-window theme listener if not already registered in this window
      if (!crossWindowSyncRegistered) {
        crossWindowSyncRegistered = true;
        setupCrossWindowThemeSync((newTheme) => {
          if (get().currentTheme !== newTheme) {
            get().setTheme(newTheme, false);
          }
        });
      }

      const savedCustomPath = localStorage.getItem(STORAGE_CUSTOM_GIT_PATH);
      if (savedCustomPath && savedCustomPath.trim().length > 0) {
        await setCustomGitPathIpc(savedCustomPath.trim());
      }

      const savedDelay = localStorage.getItem(STORAGE_DIFF_REFRESH_DELAY);
      if (savedDelay) {
        const parsed = parseInt(savedDelay, 10);
        if (!isNaN(parsed) && parsed >= 200) {
          set({ diffRefreshDelayMs: parsed });
          await setDiffDebounceDelayIpc(parsed);
        }
      } else {
        await setDiffDebounceDelayIpc(1500);
      }

      const savedDevDir = localStorage.getItem(STORAGE_DEV_DIRECTORY);
      if (savedDevDir && savedDevDir.trim().length > 0) {
        set({ devDirectory: savedDevDir.trim() });
      }

      const savedPushTags = localStorage.getItem(STORAGE_PUSH_TAGS_OPTION) as PushTagsOption | null;
      if (savedPushTags && ["none", "follow-tags", "all"].includes(savedPushTags)) {
        set({ pushTagsOption: savedPushTags });
      }

      await get().loadGitInfo();
    } catch (e) {
      console.warn("Failed to initialize settings from localStorage:", e);
    }
  },
}));
