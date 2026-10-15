import { create } from "zustand";
import type { GitBinaryInfo, SettingsTab } from "@/types";
import {
  getGitBinaryInfoIpc,
  setCustomGitPathIpc,
  validateGitPathIpc,
  pickGitExecutable,
  setDiffDebounceDelayIpc,
} from "@/lib/ipc";

const STORAGE_CUSTOM_GIT_PATH = "gitshark_custom_git_path";
const STORAGE_DIFF_REFRESH_DELAY = "gitshark_diff_refresh_delay";

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

  // Actions
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  setActiveTab: (tab: SettingsTab) => void;
  setCustomPathInput: (input: string) => void;
  setDiffRefreshDelayMs: (delayMs: number) => Promise<void>;
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
    const clamped = Math.max(200, Math.min(10000, delayMs));
    localStorage.setItem(STORAGE_DIFF_REFRESH_DELAY, String(clamped));
    set({ diffRefreshDelayMs: clamped });
    try {
      await setDiffDebounceDelayIpc(clamped);
    } catch (err) {
      console.error("Failed to sync debounce delay to Tauri backend:", err);
    }
  },

  loadGitInfo: async () => {
    set({ isLoadingGitInfo: true });
    try {
      const info = await getGitBinaryInfoIpc();
      set({
        gitInfo: info,
        customPathInput: info.is_custom ? info.current_path : "",
      });
    } catch (err) {
      console.error("Failed to load Git binary information:", err);
    } finally {
      set({ isLoadingGitInfo: false });
    }
  },

  browseForGitExecutable: async () => {
    const picked = await pickGitExecutable();
    if (picked) {
      set({ customPathInput: picked, testResult: null, saveMessage: null });
      // Automatically test the newly picked executable
      get().testPath(picked);
    }
  },

  testPath: async (path: string) => {
    const trimmed = path.trim();
    if (!trimmed) {
      set({
        testResult: { valid: false, message: "Please specify a file path." },
      });
      return;
    }

    set({ isTestingPath: true, testResult: null });
    try {
      const version = await validateGitPathIpc(trimmed);
      set({
        testResult: { valid: true, message: `Verified: ${version}` },
      });
    } catch (err) {
      set({
        testResult: {
          valid: false,
          message: err instanceof Error ? err.message : String(err),
        },
      });
    } finally {
      set({ isTestingPath: false });
    }
  },

  saveGitPath: async (customPath: string | null) => {
    set({ saveMessage: null });
    try {
      const trimmed = customPath?.trim() || null;
      const updatedInfo = await setCustomGitPathIpc(trimmed);
      if (trimmed) {
        localStorage.setItem(STORAGE_CUSTOM_GIT_PATH, trimmed);
      } else {
        localStorage.removeItem(STORAGE_CUSTOM_GIT_PATH);
      }
      set({
        gitInfo: updatedInfo,
        customPathInput: updatedInfo.is_custom ? updatedInfo.current_path : "",
        saveMessage: {
          success: true,
          message: updatedInfo.is_custom
            ? `Successfully configured custom Git: ${updatedInfo.version || updatedInfo.current_path}`
            : "Reset to auto-detected system Git.",
        },
        testResult: null,
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

      await get().loadGitInfo();
    } catch (e) {
      console.warn("Failed to initialize settings from localStorage:", e);
    }
  },
}));
