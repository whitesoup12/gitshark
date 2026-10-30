import { create } from "zustand";
import { APP_VERSION } from "@/constants/version";
import { CHANGELOG, ReleaseNote } from "@/data/changelog";

const STORAGE_LAST_SEEN_VERSION = "gitshark_last_seen_version";

interface ChangelogState {
  isOpen: boolean;
  selectedVersion: string;
  releases: ReleaseNote[];
  openWhatsNew: (version?: string) => void;
  closeWhatsNew: () => void;
  setSelectedVersion: (version: string) => void;
  checkFirstLaunchForVersion: () => boolean;
}

export const useChangelogStore = create<ChangelogState>((set) => ({
  isOpen: false,
  selectedVersion: APP_VERSION,
  releases: CHANGELOG,

  openWhatsNew: (version?: string) => {
    const targetVersion = version || APP_VERSION;
    set({
      isOpen: true,
      selectedVersion: targetVersion,
    });
    // Mark current version as seen when opened
    try {
      localStorage.setItem(STORAGE_LAST_SEEN_VERSION, APP_VERSION);
    } catch {
      // ignore
    }
  },

  closeWhatsNew: () => {
    set({ isOpen: false });
    try {
      localStorage.setItem(STORAGE_LAST_SEEN_VERSION, APP_VERSION);
    } catch {
      // ignore
    }
  },

  setSelectedVersion: (version: string) => {
    set({ selectedVersion: version });
  },

  checkFirstLaunchForVersion: () => {
    try {
      const lastSeen = localStorage.getItem(STORAGE_LAST_SEEN_VERSION);
      if (lastSeen !== APP_VERSION) {
        // First launch for this version!
        set({
          isOpen: true,
          selectedVersion: APP_VERSION,
        });
        localStorage.setItem(STORAGE_LAST_SEEN_VERSION, APP_VERSION);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  },
}));
