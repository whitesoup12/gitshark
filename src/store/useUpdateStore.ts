import { create } from "zustand";
import { APP_VERSION } from "@/constants/version";

export const GITHUB_REPO = "whitesoup12/gitshark";
export const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export function compareSemver(a: string, b: string): number {
  const cleanA = a.replace(/^v/, "").trim();
  const cleanB = b.replace(/^v/, "").trim();

  const partsA = cleanA.split(/[-+]/)[0].split(".").map((n) => parseInt(n, 10) || 0);
  const partsB = cleanB.split(/[-+]/)[0].split(".").map((n) => parseInt(n, 10) || 0);

  const maxLen = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLen; i++) {
    const valA = partsA[i] ?? 0;
    const valB = partsB[i] ?? 0;
    if (valA > valB) return 1;
    if (valA < valB) return -1;
  }
  return 0;
}

export interface UpdateState {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string;
  releaseName: string | null;
  publishedAt: string | null;
  body: string | null;
  isChecking: boolean;
  lastChecked: number | null;
  error: string | null;
  checkForUpdates: (force?: boolean) => Promise<boolean>;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  hasUpdate: false,
  currentVersion: APP_VERSION,
  latestVersion: null,
  releaseUrl: `https://github.com/${GITHUB_REPO}/releases`,
  releaseName: null,
  publishedAt: null,
  body: null,
  isChecking: false,
  lastChecked: null,
  error: null,

  checkForUpdates: async (force = false): Promise<boolean> => {
    const state = get();
    // Cache for 30 minutes unless forced
    if (!force && state.lastChecked && Date.now() - state.lastChecked < 30 * 60 * 1000) {
      return state.hasUpdate;
    }

    if (state.isChecking) return state.hasUpdate;

    set({ isChecking: true, error: null });

    try {
      const response = await fetch(RELEASES_API, {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          set({
            isChecking: false,
            error: "GitHub API rate limit reached. Please try again later.",
          });
          return false;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const latestTag = data.tag_name || "";
      const cleanLatest = latestTag.replace(/^v/, "").trim();
      const hasUpdate = compareSemver(cleanLatest, APP_VERSION) > 0;

      set({
        hasUpdate,
        latestVersion: cleanLatest,
        releaseUrl: data.html_url || `https://github.com/${GITHUB_REPO}/releases`,
        releaseName: data.name || latestTag,
        publishedAt: data.published_at || null,
        body: data.body || null,
        isChecking: false,
        lastChecked: Date.now(),
        error: null,
      });

      return hasUpdate;
    } catch (err) {
      set({
        isChecking: false,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  },
}));
