import { create } from "zustand";
import {
  Tab,
  WorkspaceView,
  RepoHooksInfo,
  HookStage,
  WorktreeItem,
  RemoteSyncStatus,
  RepoBranches,
  StashItem,
  StashDetails,
  FileDiff,
  BranchComparisonDetails,
} from "@/types";
import {
  openRepositoryIpc,
  closeRepositoryIpc,
  getRepositoryMetadataIpc,
  pickRepositoryDirectory,
  executeGitCommitIpc,
  executeGitPushIpc,
  executeGitPullIpc,
  executeGitFetchIpc,
  backgroundFetchRepositoryIpc,
  executeGitMergeIpc,
  executeGitCherryPickIpc,
  executeGitRevertIpc,
  checkoutCommitIpc,
  resetToCommitIpc,
  cancelActiveProcessIpc,
  getRepoHooksIpc,
  executeHookDryRunIpc,
  listWorktreesIpc,
  addWorktreeIpc,
  removeWorktreeIpc,
  pruneWorktreesIpc,
  getRemoteSyncStatusIpc,
  getRepoBranchesIpc,
  checkoutBranchIpc,
  createBranchIpc,
  deleteBranchIpc,
  renameBranchIpc,
  listStashesIpc,
  createStashIpc,
  applyStashIpc,
  dropStashIpc,
  getStashDetailsIpc,
  getStashFileDiffIpc,
  getBranchComparisonIpc,
  getBranchComparisonFileDiffIpc,
  listTagsIpc,
  createTagIpc,
  deleteTagIpc,
  pushTagIpc,
  listenToTerminalExit,
  listenToTerminalData,
  getRepositoryRemoteUrlIpc,
  openInBrowserIpc,
  getSavedOpenReposIpc,
  saveOpenReposIpc,
} from "@/lib/ipc";
import { GitTagItem, PullRequestInfo } from "@/types";
import { useSharkStore } from "@/store/useSharkStore";
import { parseGitRemoteUrl } from "@/lib/remoteUrl";
import { fetchRepoPullRequests } from "@/lib/pullRequests";
import { showAlert } from "@/store/useDialogStore";

interface WorkspaceState {
  tabs: Tab[];
  activeTabId: string | null;
  cloneModalOpen: boolean;

  // Actions
  createEmptyTab: () => string;
  openRepositoryTab: (path?: string) => Promise<string | null>;
  closeTab: (tabId: string) => Promise<void>;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;
  toggleTerminal: (tabId: string) => void;
  toggleSidebar: (tabId: string) => void;
  setActiveView: (tabId: string, view: WorkspaceView) => void;
  refreshTabMetadata: (tabId: string) => Promise<void>;
  setCloneModalOpen: (open: boolean) => void;
  initWorkspaceSession: () => Promise<void>;

  // Hook & Process Orchestration
  fetchRepoHooks: (tabId: string) => Promise<RepoHooksInfo | null>;
  executeHookDryRun: (tabId: string, hookName: string) => Promise<boolean>;
  executeCommit: (tabId: string, message: string, amend?: boolean) => Promise<boolean>;
  executePush: (
    tabId: string,
    remote?: string,
    branch?: string,
    force?: boolean,
    setUpstream?: boolean
  ) => Promise<boolean>;
  executePull: (tabId: string, remote?: string, branch?: string, rebase?: boolean) => Promise<boolean>;
  executeFetch: (tabId: string, remote?: string, prune?: boolean) => Promise<boolean>;
  autoFetchTab: (tabId: string) => Promise<void>;
  executeMerge: (tabId: string, branch: string) => Promise<boolean>;
  executeCherryPick: (tabId: string, commitSha: string) => Promise<boolean>;
  executeRevert: (tabId: string, commitSha: string) => Promise<boolean>;
  checkoutCommit: (tabId: string, commitSha: string) => Promise<boolean>;
  resetToCommit: (
    tabId: string,
    commitSha: string,
    mode: "soft" | "mixed" | "hard"
  ) => Promise<boolean>;
  cancelActiveProcess: (tabId: string) => Promise<void>;
  retryLastHook: (tabId: string) => Promise<void>;
  dismissHookStatus: (tabId: string) => void;

  // Milestone 5: Worktrees & Remote Sync
  fetchWorktrees: (tabId: string) => Promise<WorktreeItem[]>;
  addWorktree: (tabId: string, path: string, branch: string, newBranch?: boolean) => Promise<boolean>;
  removeWorktree: (tabId: string, path: string, force?: boolean) => Promise<boolean>;
  pruneWorktrees: (tabId: string) => Promise<boolean>;
  fetchRemoteSyncStatus: (tabId: string) => Promise<RemoteSyncStatus | null>;

  // Branches
  fetchBranches: (tabId: string) => Promise<RepoBranches | null>;
  checkoutBranch: (tabId: string, branchName: string) => Promise<boolean>;
  createBranch: (tabId: string, branchName: string, targetCommit?: string, checkout?: boolean) => Promise<boolean>;
  deleteBranch: (tabId: string, branchName: string, isRemote?: boolean) => Promise<boolean>;
  renameBranch: (tabId: string, oldName: string, newName: string) => Promise<boolean>;

  // Stashes
  fetchStashes: (tabId: string) => Promise<StashItem[]>;
  fetchStashDetails: (tabId: string, stashIndex: number) => Promise<StashDetails | null>;
  fetchStashFileDiff: (tabId: string, stashIndex: number, filePath: string) => Promise<FileDiff | null>;
  createStash: (tabId: string, message?: string, includeUntracked?: boolean) => Promise<boolean>;
  applyStash: (tabId: string, index: number, pop?: boolean) => Promise<boolean>;
  dropStash: (tabId: string, index: number) => Promise<boolean>;

  // Tags
  fetchTags: (tabId: string) => Promise<GitTagItem[]>;
  createTag: (
    tabId: string,
    tagName: string,
    targetCommit?: string,
    message?: string,
    pushToRemote?: boolean
  ) => Promise<boolean>;
  deleteTag: (tabId: string, tagName: string) => Promise<boolean>;
  pushTag: (tabId: string, tagName: string, remote?: string) => Promise<boolean>;

  // Browser Navigation & Pull Requests
  openRepoInBrowser: (tabId: string) => Promise<boolean>;
  createPullRequestInBrowser: (tabId: string, branchName?: string) => Promise<boolean>;
  fetchPullRequests: (tabId: string) => Promise<PullRequestInfo[]>;

  // Branch Comparison & PR View
  fetchBranchComparison: (
    tabId: string,
    baseRef: string,
    compareRef: string,
    includeUncommitted?: boolean
  ) => Promise<BranchComparisonDetails | null>;
  fetchBranchComparisonFileDiff: (
    tabId: string,
    baseRef: string,
    compareRef: string,
    filePath: string,
    includeUncommitted?: boolean
  ) => Promise<FileDiff | null>;
  openInPrView: (tabId: string, compareBranch?: string, baseBranch?: string) => void;
}

// Module-level timers map for elapsed stopwatch per tab
const activeTimers = new Map<string, ReturnType<typeof setInterval>>();
const lastAutoFetchMap = new Map<string, number>();

let sessionInitialized = false;
let isInitializingSession = false;

const persistOpenReposSession = (tabs: Tab[], activeTabId: string | null) => {
  if (!sessionInitialized) return;
  const open_paths = tabs
    .map((t) => t.path)
    .filter((p): p is string => Boolean(p));
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const active_path = activeTab?.path || null;

  saveOpenReposIpc({ open_paths, active_path }).catch((err) => {
    console.error("Failed to save open repos session:", err);
  });
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  cloneModalOpen: false,

  initWorkspaceSession: async () => {
    if (sessionInitialized || isInitializingSession) return;
    isInitializingSession = true;

    try {
      const session = await getSavedOpenReposIpc();
      if (session && session.open_paths && session.open_paths.length > 0) {
        for (const repoPath of session.open_paths) {
          try {
            await get().openRepositoryTab(repoPath);
          } catch (e) {
            console.warn(`Failed to restore saved repository at '${repoPath}':`, e);
          }
        }

        if (session.active_path) {
          const currentTabs = get().tabs;
          const matched = currentTabs.find(
            (t) => t.path && t.path.toLowerCase() === session.active_path!.toLowerCase()
          );
          if (matched) {
            get().setActiveTab(matched.id);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to initialize open repositories session:", err);
    } finally {
      sessionInitialized = true;
      isInitializingSession = false;
      persistOpenReposSession(get().tabs, get().activeTabId);
    }
  },

  setCloneModalOpen: (open: boolean) => {
    set({ cloneModalOpen: open });
  },

  createEmptyTab: () => {
    const id = "tab-" + Math.random().toString(36).substring(2, 9);
    const newTab: Tab = {
      id,
      repoId: null,
      title: "New Workspace",
      path: null,
      isLoading: false,
      activeView: "status",
      terminalOpen: false,
      sidebarCollapsed: false,
      selectedCommitHash: null,
      selectedFilePath: null,
    };

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
    }));

    return id;
  },

  openRepositoryTab: async (explicitPath?: string) => {
    let targetPath = explicitPath;

    if (!targetPath) {
      const selected = await pickRepositoryDirectory();
      if (!selected) {
        return null;
      }
      targetPath = selected;
    }

    // Check if repository path is already opened in an existing tab
    const existingTab = get().tabs.find(
      (t) => t.path && t.path.toLowerCase() === targetPath!.toLowerCase()
    );
    if (existingTab) {
      set({ activeTabId: existingTab.id });
      persistOpenReposSession(get().tabs, existingTab.id);
      return existingTab.id;
    }

    const tabId = "tab-" + Math.random().toString(36).substring(2, 9);
    const initialTab: Tab = {
      id: tabId,
      repoId: null,
      title: targetPath.split(/[/\\]/).filter(Boolean).pop() || "Repository",
      path: targetPath,
      isLoading: true,
      error: null,
      activeView: "status",
      terminalOpen: false,
      sidebarCollapsed: false,
      selectedCommitHash: null,
      selectedFilePath: null,
    };

    set((state) => ({
      tabs: [...state.tabs, initialTab],
      activeTabId: tabId,
    }));

    try {
      const metadata = await openRepositoryIpc(targetPath);

      let hooksInfo: RepoHooksInfo | undefined;
      let remoteSync: RemoteSyncStatus | undefined;
      let worktrees: WorktreeItem[] | undefined;
      let branches: RepoBranches | undefined;
      let stashes: StashItem[] | undefined;

      try {
        [hooksInfo, remoteSync, worktrees, branches, stashes] = await Promise.all([
          getRepoHooksIpc(metadata.id).catch(() => undefined),
          getRemoteSyncStatusIpc(metadata.id).catch(() => undefined),
          listWorktreesIpc(metadata.id).catch(() => undefined),
          getRepoBranchesIpc(metadata.id).catch(() => undefined),
          listStashesIpc(metadata.id).catch(() => undefined),
        ]);
      } catch {
        // optional secondary data
      }

      set((state) => ({
        tabs: state.tabs.map((tab) =>
          tab.id === tabId
            ? {
                ...tab,
                repoId: metadata.id,
                title: metadata.name,
                metadata,
                hooksInfo,
                remoteSync,
                worktrees,
                branches,
                stashes,
                isLoading: false,
                error: null,
              }
            : tab
        ),
      }));
      get().autoFetchTab(tabId);
      persistOpenReposSession(get().tabs, tabId);
      return tabId;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      set((state) => ({
        tabs: state.tabs.map((tab) =>
          tab.id === tabId
            ? {
                ...tab,
                isLoading: false,
                error: errorMessage,
              }
            : tab
        ),
      }));
      persistOpenReposSession(get().tabs, tabId);
      return tabId;
    }
  },

  closeTab: async (tabId: string) => {
    const { tabs, activeTabId } = get();
    const tabToClose = tabs.find((t) => t.id === tabId);

    if (activeTimers.has(tabId)) {
      clearInterval(activeTimers.get(tabId)!);
      activeTimers.delete(tabId);
    }

    if (tabToClose?.repoId) {
      try {
        await closeRepositoryIpc(tabToClose.repoId);
      } catch (err) {
        console.error("Error closing backend repo session:", err);
      }
    }

    const remainingTabs = tabs.filter((t) => t.id !== tabId);
    let nextActiveId = activeTabId;

    if (activeTabId === tabId) {
      if (remainingTabs.length > 0) {
        const closedIndex = tabs.findIndex((t) => t.id === tabId);
        const newIndex = Math.min(closedIndex, remainingTabs.length - 1);
        nextActiveId = remainingTabs[newIndex].id;
      } else {
        nextActiveId = null;
      }
    }

    set({
      tabs: remainingTabs,
      activeTabId: nextActiveId,
    });

    if (nextActiveId) {
      get().autoFetchTab(nextActiveId);
    }
    persistOpenReposSession(remainingTabs, nextActiveId);
  },

  setActiveTab: (tabId: string) => {
    set({ activeTabId: tabId });
    get().autoFetchTab(tabId);
    persistOpenReposSession(get().tabs, tabId);
  },

  updateTab: (tabId: string, updates: Partial<Tab>) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, ...updates } : tab
      ),
    }));
  },

  toggleTerminal: (tabId: string) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId
          ? { ...tab, terminalOpen: !tab.terminalOpen }
          : tab
      ),
    }));
  },

  toggleSidebar: (tabId: string) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId
          ? { ...tab, sidebarCollapsed: !tab.sidebarCollapsed }
          : tab
      ),
    }));
  },

  setActiveView: (tabId: string, view: WorkspaceView) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, activeView: view } : tab
      ),
    }));
  },

  refreshTabMetadata: async (tabId: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return;

    try {
      const metadata = await getRepositoryMetadataIpc(tab.repoId);
      const nextEpoch = (tab.refreshEpoch ?? 0) + 1;
      get().updateTab(tabId, {
        metadata,
        title: metadata.name,
        refreshEpoch: nextEpoch,
      });

      // Concurrently refresh remote sync, worktrees, branches, stashes, tags, and pull requests
      await Promise.allSettled([
        get().fetchRemoteSyncStatus(tabId),
        get().fetchWorktrees(tabId),
        get().fetchBranches(tabId),
        get().fetchStashes(tabId),
        get().fetchTags(tabId),
        get().fetchPullRequests(tabId),
      ]);
    } catch (err) {
      console.error("Failed to refresh repository metadata:", err);
    }
  },

  fetchRepoHooks: async (tabId: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return null;

    try {
      const hooksInfo = await getRepoHooksIpc(tab.repoId);
      get().updateTab(tabId, { hooksInfo });
      return hooksInfo;
    } catch (err) {
      console.warn("Failed to fetch repo hooks:", err);
      return null;
    }
  },

  executeCommit: async (tabId: string, message: string, amend: boolean = false): Promise<boolean> => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    const repoId = tab.repoId;

    // 1. Fetch or use existing hooks info
    let hooksInfo = tab.hooksInfo;
    if (!hooksInfo) {
      try {
        hooksInfo = await getRepoHooksIpc(repoId);
        get().updateTab(tabId, { hooksInfo });
      } catch (e) {
        console.warn("Failed to query hooks info:", e);
      }
    }

    const hasPreCommit = hooksInfo?.has_pre_commit ?? false;
    const initialStage: HookStage = hasPreCommit ? "pre-commit" : "committing";

    // 2. Open terminal drawer immediately
    get().updateTab(tabId, {
      terminalOpen: true,
      hookState: {
        stage: initialStage,
        status: "running",
        elapsedSeconds: 0,
        lastCommand: "commit",
        lastMessage: message,
        lastAmend: amend,
        exitCode: null,
        error: null,
      },
    });

    if (activeTimers.has(tabId)) {
      clearInterval(activeTimers.get(tabId)!);
      activeTimers.delete(tabId);
    }

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const currentTab = get().tabs.find((t) => t.id === tabId);
      if (currentTab?.hookState && currentTab.hookState.status === "running") {
        get().updateTab(tabId, {
          hookState: {
            ...currentTab.hookState,
            elapsedSeconds: Number(elapsed.toFixed(1)),
          },
        });
      }
    }, 100);
    activeTimers.set(tabId, timer);

    return new Promise<boolean>(async (resolve) => {
      let isDone = false;
      let unlistenDataFn: (() => void) | null = null;
      let unlistenExitFn: (() => void) | null = null;

      const cleanup = () => {
        if (activeTimers.has(tabId)) {
          clearInterval(activeTimers.get(tabId)!);
          activeTimers.delete(tabId);
        }
        if (unlistenExitFn) {
          unlistenExitFn();
          unlistenExitFn = null;
        }
        if (unlistenDataFn) {
          unlistenDataFn();
          unlistenDataFn = null;
        }
      };

      try {
        unlistenDataFn = await listenToTerminalData(repoId, (chunk) => {
          if (chunk.toLowerCase().includes("commit-msg")) {
            const cur = get().tabs.find((t) => t.id === tabId);
            if (cur?.hookState && cur.hookState.status === "running") {
              get().updateTab(tabId, {
                hookState: { ...cur.hookState, stage: "commit-msg" },
              });
            }
          }
        });

        unlistenExitFn = await listenToTerminalExit(repoId, async (payload) => {
          if (isDone) return;
          isDone = true;
          cleanup();

          const totalElapsed = (Date.now() - startTime) / 1000;
          const resolvedStage: HookStage = hasPreCommit ? "pre-commit" : "committing";

          if (payload.success) {
            get().updateTab(tabId, {
              hookState: {
                stage: resolvedStage,
                status: "passed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "commit",
                lastMessage: message,
                lastAmend: amend,
                exitCode: 0,
              },
            });

            await get().refreshTabMetadata(tabId);
            useSharkStore.getState().recordSharkStat("commit", 1);
            useSharkStore.getState().triggerCelebration("swim", "Commit Chomped! (+1 XP) 🦈");

            setTimeout(() => {
              const checkTab = get().tabs.find((t) => t.id === tabId);
              if (checkTab?.hookState?.status === "passed") {
                get().updateTab(tabId, { terminalOpen: false });
              }
            }, 1500);

            resolve(true);
          } else {
            get().updateTab(tabId, {
              terminalOpen: true,
              hookState: {
                stage: resolvedStage,
                status: "failed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "commit",
                lastMessage: message,
                lastAmend: amend,
                exitCode: payload.exit_code ?? 1,
                error: `Process failed with exit code ${payload.exit_code ?? 1}`,
              },
            });
            resolve(false);
          }
        });

        await executeGitCommitIpc(repoId, message, amend);
      } catch (err) {
        if (isDone) return;
        isDone = true;
        cleanup();

        get().updateTab(tabId, {
          terminalOpen: true,
          hookState: {
            stage: initialStage,
            status: "failed",
            elapsedSeconds: Number(((Date.now() - startTime) / 1000).toFixed(1)),
            lastCommand: "commit",
            lastMessage: message,
            lastAmend: amend,
            exitCode: 1,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        resolve(false);
      }
    });
  },

  executePush: async (
    tabId: string,
    remote?: string,
    branch?: string,
    force: boolean = false,
    setUpstream: boolean = false
  ): Promise<boolean> => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    const repoId = tab.repoId;
    const hasPrePush = tab.hooksInfo?.has_pre_push ?? false;
    const initialStage: HookStage = hasPrePush ? "pre-push" : "pushing";

    get().updateTab(tabId, {
      terminalOpen: true,
      hookState: {
        stage: initialStage,
        status: "running",
        elapsedSeconds: 0,
        lastCommand: "push",
        exitCode: null,
        error: null,
      },
    });

    if (activeTimers.has(tabId)) {
      clearInterval(activeTimers.get(tabId)!);
      activeTimers.delete(tabId);
    }

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const currentTab = get().tabs.find((t) => t.id === tabId);
      if (currentTab?.hookState && currentTab.hookState.status === "running") {
        get().updateTab(tabId, {
          hookState: {
            ...currentTab.hookState,
            elapsedSeconds: Number(elapsed.toFixed(1)),
          },
        });
      }
    }, 100);
    activeTimers.set(tabId, timer);

    return new Promise<boolean>(async (resolve) => {
      let isDone = false;
      let unlistenExitFn: (() => void) | null = null;

      const cleanup = () => {
        if (activeTimers.has(tabId)) {
          clearInterval(activeTimers.get(tabId)!);
          activeTimers.delete(tabId);
        }
        if (unlistenExitFn) {
          unlistenExitFn();
          unlistenExitFn = null;
        }
      };

      try {
        unlistenExitFn = await listenToTerminalExit(repoId, async (payload) => {
          if (isDone) return;
          isDone = true;
          cleanup();

          const totalElapsed = (Date.now() - startTime) / 1000;

          if (payload.success) {
            get().updateTab(tabId, {
              hookState: {
                stage: initialStage,
                status: "passed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "push",
                exitCode: 0,
              },
            });

            await get().refreshTabMetadata(tabId);
            useSharkStore.getState().recordSharkStat("push", 1);
            useSharkStore.getState().triggerCelebration("swim", "Pushed to Remote Seas! (+5 XP) 🌊");

            setTimeout(() => {
              const checkTab = get().tabs.find((t) => t.id === tabId);
              if (checkTab?.hookState?.status === "passed") {
                get().updateTab(tabId, { terminalOpen: false });
              }
            }, 1500);

            resolve(true);
          } else {
            get().updateTab(tabId, {
              terminalOpen: true,
              hookState: {
                stage: initialStage,
                status: "failed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "push",
                exitCode: payload.exit_code ?? 1,
                error: `Push failed with exit code ${payload.exit_code ?? 1}`,
              },
            });
            resolve(false);
          }
        });

        await executeGitPushIpc(repoId, remote, branch, force, setUpstream);
      } catch (err) {
        if (isDone) return;
        isDone = true;
        cleanup();

        get().updateTab(tabId, {
          terminalOpen: true,
          hookState: {
            stage: initialStage,
            status: "failed",
            elapsedSeconds: Number(((Date.now() - startTime) / 1000).toFixed(1)),
            lastCommand: "push",
            exitCode: 1,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        resolve(false);
      }
    });
  },

  executePull: async (
    tabId: string,
    remote?: string,
    branch?: string,
    rebase: boolean = false
  ): Promise<boolean> => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    const repoId = tab.repoId;

    get().updateTab(tabId, {
      terminalOpen: true,
      hookState: {
        stage: "committing",
        status: "running",
        elapsedSeconds: 0,
        lastCommand: "pull",
        exitCode: null,
        error: null,
      },
    });

    if (activeTimers.has(tabId)) {
      clearInterval(activeTimers.get(tabId)!);
      activeTimers.delete(tabId);
    }

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const currentTab = get().tabs.find((t) => t.id === tabId);
      if (currentTab?.hookState && currentTab.hookState.status === "running") {
        get().updateTab(tabId, {
          hookState: {
            ...currentTab.hookState,
            elapsedSeconds: Number(elapsed.toFixed(1)),
          },
        });
      }
    }, 100);
    activeTimers.set(tabId, timer);

    return new Promise<boolean>(async (resolve) => {
      let isDone = false;
      let unlistenExitFn: (() => void) | null = null;

      const cleanup = () => {
        if (activeTimers.has(tabId)) {
          clearInterval(activeTimers.get(tabId)!);
          activeTimers.delete(tabId);
        }
        if (unlistenExitFn) {
          unlistenExitFn();
          unlistenExitFn = null;
        }
      };

      try {
        unlistenExitFn = await listenToTerminalExit(repoId, async (payload) => {
          if (isDone) return;
          isDone = true;
          cleanup();

          const totalElapsed = (Date.now() - startTime) / 1000;

          if (payload.success) {
            get().updateTab(tabId, {
              hookState: {
                stage: "committing",
                status: "passed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "pull",
                exitCode: 0,
              },
            });

            await get().refreshTabMetadata(tabId);

            setTimeout(() => {
              const checkTab = get().tabs.find((t) => t.id === tabId);
              if (checkTab?.hookState?.status === "passed") {
                get().updateTab(tabId, { terminalOpen: false });
              }
            }, 1500);

            resolve(true);
          } else {
            get().updateTab(tabId, {
              terminalOpen: true,
              hookState: {
                stage: "committing",
                status: "failed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "pull",
                exitCode: payload.exit_code ?? 1,
                error: `Pull failed with exit code ${payload.exit_code ?? 1}`,
              },
            });
            resolve(false);
          }
        });

        await executeGitPullIpc(repoId, remote, branch, rebase);
      } catch (err) {
        if (isDone) return;
        isDone = true;
        cleanup();

        get().updateTab(tabId, {
          terminalOpen: true,
          hookState: {
            stage: "committing",
            status: "failed",
            elapsedSeconds: Number(((Date.now() - startTime) / 1000).toFixed(1)),
            lastCommand: "pull",
            exitCode: 1,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        resolve(false);
      }
    });
  },

  executeFetch: async (
    tabId: string,
    remote?: string,
    prune: boolean = true
  ): Promise<boolean> => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    const repoId = tab.repoId;
    get().updateTab(tabId, {
      terminalOpen: true,
      hookState: {
        stage: "idle",
        status: "running",
        elapsedSeconds: 0,
        lastCommand: "fetch",
        exitCode: null,
        error: null,
      },
    });

    if (activeTimers.has(tabId)) {
      clearInterval(activeTimers.get(tabId)!);
      activeTimers.delete(tabId);
    }

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const currentTab = get().tabs.find((t) => t.id === tabId);
      if (currentTab?.hookState && currentTab.hookState.status === "running") {
        get().updateTab(tabId, {
          hookState: {
            ...currentTab.hookState,
            elapsedSeconds: Number(elapsed.toFixed(1)),
          },
        });
      }
    }, 100);
    activeTimers.set(tabId, timer);

    return new Promise<boolean>(async (resolve) => {
      let isDone = false;
      let unlistenExitFn: (() => void) | null = null;

      const cleanup = () => {
        if (activeTimers.has(tabId)) {
          clearInterval(activeTimers.get(tabId)!);
          activeTimers.delete(tabId);
        }
        if (unlistenExitFn) {
          unlistenExitFn();
          unlistenExitFn = null;
        }
      };

      try {
        unlistenExitFn = await listenToTerminalExit(repoId, async (payload) => {
          if (isDone) return;
          isDone = true;
          cleanup();

          const totalElapsed = (Date.now() - startTime) / 1000;

          if (payload.success) {
            get().updateTab(tabId, {
              hookState: {
                stage: "idle",
                status: "passed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "fetch",
                exitCode: 0,
              },
            });

            await get().refreshTabMetadata(tabId);

            setTimeout(() => {
              const checkTab = get().tabs.find((t) => t.id === tabId);
              if (checkTab?.hookState?.status === "passed") {
                get().updateTab(tabId, { terminalOpen: false });
              }
            }, 1200);

            resolve(true);
          } else {
            get().updateTab(tabId, {
              terminalOpen: true,
              hookState: {
                stage: "idle",
                status: "failed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "fetch",
                exitCode: payload.exit_code ?? 1,
                error: `Fetch failed with exit code ${payload.exit_code ?? 1}`,
              },
            });
            resolve(false);
          }
        });

        await executeGitFetchIpc(repoId, remote, prune);
      } catch (err) {
        if (isDone) return;
        isDone = true;
        cleanup();

        get().updateTab(tabId, {
          terminalOpen: true,
          hookState: {
            stage: "idle",
            status: "failed",
            elapsedSeconds: Number(((Date.now() - startTime) / 1000).toFixed(1)),
            lastCommand: "fetch",
            exitCode: 1,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        resolve(false);
      }
    });
  },

  autoFetchTab: async (tabId: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return;

    const now = Date.now();
    const lastTime = lastAutoFetchMap.get(tabId) ?? 0;
    // Debounce / cooldown of 15 seconds to avoid spamming network when switching tabs
    if (now - lastTime < 15000) return;
    lastAutoFetchMap.set(tabId, now);

    try {
      await backgroundFetchRepositoryIpc(tab.repoId);
      await Promise.all([
        get().fetchBranches(tabId),
        get().fetchRemoteSyncStatus(tabId),
        get().refreshTabMetadata(tabId),
      ]);
    } catch {
      // Gracefully handle offline or unreachable remote
      await Promise.all([
        get().fetchBranches(tabId),
        get().fetchRemoteSyncStatus(tabId),
      ]);
    }
  },

  executeMerge: async (tabId: string, branch: string): Promise<boolean> => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    const repoId = tab.repoId;
    const currentBranch = (tab.metadata?.current_branch || "").toLowerCase();

    get().updateTab(tabId, {
      terminalOpen: true,
      hookState: {
        stage: "committing",
        status: "running",
        elapsedSeconds: 0,
        lastCommand: "merge",
        exitCode: null,
        error: null,
      },
    });

    if (activeTimers.has(tabId)) {
      clearInterval(activeTimers.get(tabId)!);
      activeTimers.delete(tabId);
    }

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const currentTab = get().tabs.find((t) => t.id === tabId);
      if (currentTab?.hookState && currentTab.hookState.status === "running") {
        get().updateTab(tabId, {
          hookState: {
            ...currentTab.hookState,
            elapsedSeconds: Number(elapsed.toFixed(1)),
          },
        });
      }
    }, 100);
    activeTimers.set(tabId, timer);

    return new Promise<boolean>(async (resolve) => {
      let isDone = false;
      let unlistenExitFn: (() => void) | null = null;

      const cleanup = () => {
        if (activeTimers.has(tabId)) {
          clearInterval(activeTimers.get(tabId)!);
          activeTimers.delete(tabId);
        }
        if (unlistenExitFn) {
          unlistenExitFn();
          unlistenExitFn = null;
        }
      };

      try {
        unlistenExitFn = await listenToTerminalExit(repoId, async (payload) => {
          if (isDone) return;
          isDone = true;
          cleanup();

          const totalElapsed = (Date.now() - startTime) / 1000;

          if (payload.success) {
            get().updateTab(tabId, {
              hookState: {
                stage: "committing",
                status: "passed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "merge",
                exitCode: 0,
              },
            });

            await get().refreshTabMetadata(tabId);

            useSharkStore
              .getState()
              .triggerCelebration(
                "swim",
                `Branch '${branch}' merged into ${currentBranch}! 🦈`
              );

            setTimeout(() => {
              const checkTab = get().tabs.find((t) => t.id === tabId);
              if (checkTab?.hookState?.status === "passed") {
                get().updateTab(tabId, { terminalOpen: false });
              }
            }, 1500);

            resolve(true);
          } else {
            get().updateTab(tabId, {
              terminalOpen: true,
              hookState: {
                stage: "committing",
                status: "failed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "merge",
                exitCode: payload.exit_code ?? 1,
                error: `Merge failed with exit code ${payload.exit_code ?? 1}`,
              },
            });
            resolve(false);
          }
        });

        await executeGitMergeIpc(repoId, branch);
      } catch (err) {
        if (isDone) return;
        isDone = true;
        cleanup();

        get().updateTab(tabId, {
          terminalOpen: true,
          hookState: {
            stage: "committing",
            status: "failed",
            elapsedSeconds: Number(((Date.now() - startTime) / 1000).toFixed(1)),
            lastCommand: "merge",
            exitCode: 1,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        resolve(false);
      }
    });
  },

  executeCherryPick: async (tabId: string, commitSha: string): Promise<boolean> => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    const repoId = tab.repoId;
    get().updateTab(tabId, {
      terminalOpen: true,
      hookState: {
        stage: "committing",
        status: "running",
        elapsedSeconds: 0,
        lastCommand: "commit",
        exitCode: null,
        error: null,
      },
    });

    if (activeTimers.has(tabId)) {
      clearInterval(activeTimers.get(tabId)!);
      activeTimers.delete(tabId);
    }

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const currentTab = get().tabs.find((t) => t.id === tabId);
      if (currentTab?.hookState && currentTab.hookState.status === "running") {
        get().updateTab(tabId, {
          hookState: {
            ...currentTab.hookState,
            elapsedSeconds: Number(elapsed.toFixed(1)),
          },
        });
      }
    }, 100);
    activeTimers.set(tabId, timer);

    return new Promise<boolean>(async (resolve) => {
      let isDone = false;
      let unlistenExitFn: (() => void) | null = null;

      const cleanup = () => {
        if (activeTimers.has(tabId)) {
          clearInterval(activeTimers.get(tabId)!);
          activeTimers.delete(tabId);
        }
        if (unlistenExitFn) {
          unlistenExitFn();
          unlistenExitFn = null;
        }
      };

      try {
        unlistenExitFn = await listenToTerminalExit(repoId, async (payload) => {
          if (isDone) return;
          isDone = true;
          cleanup();

          const totalElapsed = (Date.now() - startTime) / 1000;

          if (payload.success) {
            get().updateTab(tabId, {
              hookState: {
                stage: "committing",
                status: "passed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "commit",
                exitCode: 0,
              },
            });

            await get().refreshTabMetadata(tabId);
            useSharkStore.getState().recordSharkStat("commit", 1);
            useSharkStore
              .getState()
              .triggerCelebration(
                "swim",
                `Cherry-picked ${commitSha.slice(0, 7)}! 🍒🦈`
              );

            setTimeout(() => {
              const checkTab = get().tabs.find((t) => t.id === tabId);
              if (checkTab?.hookState?.status === "passed") {
                get().updateTab(tabId, { terminalOpen: false });
              }
            }, 1500);

            resolve(true);
          } else {
            get().updateTab(tabId, {
              terminalOpen: true,
              hookState: {
                stage: "committing",
                status: "failed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "commit",
                exitCode: payload.exit_code ?? 1,
                error: `Cherry-pick failed with exit code ${payload.exit_code ?? 1}`,
              },
            });
            resolve(false);
          }
        });

        await executeGitCherryPickIpc(repoId, commitSha);
      } catch (err) {
        if (isDone) return;
        isDone = true;
        cleanup();

        get().updateTab(tabId, {
          terminalOpen: true,
          hookState: {
            stage: "committing",
            status: "failed",
            elapsedSeconds: Number(((Date.now() - startTime) / 1000).toFixed(1)),
            lastCommand: "commit",
            exitCode: 1,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        resolve(false);
      }
    });
  },

  executeRevert: async (tabId: string, commitSha: string): Promise<boolean> => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    const repoId = tab.repoId;
    get().updateTab(tabId, {
      terminalOpen: true,
      hookState: {
        stage: "committing",
        status: "running",
        elapsedSeconds: 0,
        lastCommand: "commit",
        exitCode: null,
        error: null,
      },
    });

    if (activeTimers.has(tabId)) {
      clearInterval(activeTimers.get(tabId)!);
      activeTimers.delete(tabId);
    }

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const currentTab = get().tabs.find((t) => t.id === tabId);
      if (currentTab?.hookState && currentTab.hookState.status === "running") {
        get().updateTab(tabId, {
          hookState: {
            ...currentTab.hookState,
            elapsedSeconds: Number(elapsed.toFixed(1)),
          },
        });
      }
    }, 100);
    activeTimers.set(tabId, timer);

    return new Promise<boolean>(async (resolve) => {
      let isDone = false;
      let unlistenExitFn: (() => void) | null = null;

      const cleanup = () => {
        if (activeTimers.has(tabId)) {
          clearInterval(activeTimers.get(tabId)!);
          activeTimers.delete(tabId);
        }
        if (unlistenExitFn) {
          unlistenExitFn();
          unlistenExitFn = null;
        }
      };

      try {
        unlistenExitFn = await listenToTerminalExit(repoId, async (payload) => {
          if (isDone) return;
          isDone = true;
          cleanup();

          const totalElapsed = (Date.now() - startTime) / 1000;

          if (payload.success) {
            get().updateTab(tabId, {
              hookState: {
                stage: "committing",
                status: "passed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "commit",
                exitCode: 0,
              },
            });

            await get().refreshTabMetadata(tabId);
            useSharkStore.getState().recordSharkStat("chomp", 1);
            useSharkStore
              .getState()
              .triggerCelebration(
                "chomp",
                `Reverted commit ${commitSha.slice(0, 7)}! 🦈`
              );

            setTimeout(() => {
              const checkTab = get().tabs.find((t) => t.id === tabId);
              if (checkTab?.hookState?.status === "passed") {
                get().updateTab(tabId, { terminalOpen: false });
              }
            }, 1500);

            resolve(true);
          } else {
            get().updateTab(tabId, {
              terminalOpen: true,
              hookState: {
                stage: "committing",
                status: "failed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "commit",
                exitCode: payload.exit_code ?? 1,
                error: `Revert failed with exit code ${payload.exit_code ?? 1}`,
              },
            });
            resolve(false);
          }
        });

        await executeGitRevertIpc(repoId, commitSha);
      } catch (err) {
        if (isDone) return;
        isDone = true;
        cleanup();

        get().updateTab(tabId, {
          terminalOpen: true,
          hookState: {
            stage: "committing",
            status: "failed",
            elapsedSeconds: Number(((Date.now() - startTime) / 1000).toFixed(1)),
            lastCommand: "commit",
            exitCode: 1,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        resolve(false);
      }
    });
  },

  checkoutCommit: async (tabId: string, commitSha: string): Promise<boolean> => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    try {
      await checkoutCommitIpc(tab.repoId, commitSha);
      await get().refreshTabMetadata(tabId);
      await get().fetchBranches(tabId);
      return true;
    } catch (err) {
      console.error("Failed to checkout commit:", err);
      showAlert({
        title: "Checkout Commit Failed",
        message: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return false;
    }
  },

  resetToCommit: async (
    tabId: string,
    commitSha: string,
    mode: "soft" | "mixed" | "hard"
  ): Promise<boolean> => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    try {
      await resetToCommitIpc(tab.repoId, commitSha, mode);
      await get().refreshTabMetadata(tabId);
      await get().fetchBranches(tabId);
      if (mode === "hard") {
        useSharkStore.getState().recordSharkStat("chomp", 1);
        useSharkStore
          .getState()
          .triggerCelebration(
            "chomp",
            `Hard reset to ${commitSha.slice(0, 7)} — chomped clean! 🦈`
          );
      }
      return true;
    } catch (err) {
      console.error("Failed to reset to commit:", err);
      showAlert({
        title: "Reset Commit Failed",
        message: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return false;
    }
  },

  cancelActiveProcess: async (tabId: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return;

    if (activeTimers.has(tabId)) {
      clearInterval(activeTimers.get(tabId)!);
      activeTimers.delete(tabId);
    }

    try {
      await cancelActiveProcessIpc(tab.repoId);
    } catch (e) {
      console.warn("Cancel process failed:", e);
    }

    const currentTab = get().tabs.find((t) => t.id === tabId);
    if (currentTab?.hookState) {
      get().updateTab(tabId, {
        hookState: {
          ...currentTab.hookState,
          status: "aborted",
        },
      });
    }
  },

  executeHookDryRun: async (tabId: string, hookName: string): Promise<boolean> => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    const repoId = tab.repoId;
    const stage: HookStage = hookName;

    // 1. Open terminal drawer immediately & set running state
    get().updateTab(tabId, {
      terminalOpen: true,
      hookState: {
        stage,
        status: "running",
        elapsedSeconds: 0,
        lastCommand: "dry-run",
        lastHookName: hookName,
        exitCode: null,
        error: null,
      },
    });

    if (activeTimers.has(tabId)) {
      clearInterval(activeTimers.get(tabId)!);
      activeTimers.delete(tabId);
    }

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const currentTab = get().tabs.find((t) => t.id === tabId);
      if (currentTab?.hookState && currentTab.hookState.status === "running") {
        get().updateTab(tabId, {
          hookState: {
            ...currentTab.hookState,
            elapsedSeconds: Number(elapsed.toFixed(1)),
          },
        });
      }
    }, 100);
    activeTimers.set(tabId, timer);

    return new Promise<boolean>(async (resolve) => {
      let isDone = false;
      let unlistenExitFn: (() => void) | null = null;

      const cleanup = () => {
        if (activeTimers.has(tabId)) {
          clearInterval(activeTimers.get(tabId)!);
          activeTimers.delete(tabId);
        }
        if (unlistenExitFn) {
          unlistenExitFn();
          unlistenExitFn = null;
        }
      };

      try {
        unlistenExitFn = await listenToTerminalExit(repoId, async (payload) => {
          if (isDone) return;
          isDone = true;
          cleanup();

          const totalElapsed = (Date.now() - startTime) / 1000;

          if (payload.success) {
            get().updateTab(tabId, {
              hookState: {
                stage,
                status: "passed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "dry-run",
                lastHookName: hookName,
                exitCode: 0,
              },
            });
            resolve(true);
          } else {
            get().updateTab(tabId, {
              hookState: {
                stage,
                status: "failed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "dry-run",
                lastHookName: hookName,
                exitCode: payload.exit_code ?? 1,
                error: `Hook dry-run failed with exit code ${payload.exit_code ?? 1}`,
              },
            });
            resolve(false);
          }
        });

        await executeHookDryRunIpc(repoId, hookName);
      } catch (err) {
        if (isDone) return;
        isDone = true;
        cleanup();

        get().updateTab(tabId, {
          terminalOpen: true,
          hookState: {
            stage,
            status: "failed",
            elapsedSeconds: Number(((Date.now() - startTime) / 1000).toFixed(1)),
            lastCommand: "dry-run",
            lastHookName: hookName,
            exitCode: 1,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        resolve(false);
      }
    });
  },

  retryLastHook: async (tabId: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab?.hookState) return;
    const { lastCommand, lastMessage, lastAmend, lastHookName } = tab.hookState;
    if (lastCommand === "dry-run" && lastHookName) {
      await get().executeHookDryRun(tabId, lastHookName);
    } else if (lastCommand === "commit" && lastMessage !== undefined) {
      await get().executeCommit(tabId, lastMessage, lastAmend ?? false);
    } else if (lastCommand === "push") {
      await get().executePush(tabId);
    }
  },

  dismissHookStatus: (tabId: string) => {
    get().updateTab(tabId, {
      hookState: undefined,
    });
  },

  fetchWorktrees: async (tabId: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return [];

    try {
      const worktrees = await listWorktreesIpc(tab.repoId);
      get().updateTab(tabId, { worktrees });
      return worktrees;
    } catch (err) {
      console.warn("Failed to fetch worktrees:", err);
      return [];
    }
  },

  addWorktree: async (
    tabId: string,
    path: string,
    branch: string,
    newBranch: boolean = false
  ) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    try {
      await addWorktreeIpc(tab.repoId, path, branch, newBranch);
      await get().fetchWorktrees(tabId);
      await get().refreshTabMetadata(tabId);
      return true;
    } catch (err) {
      console.error("Failed to add worktree:", err);
      return false;
    }
  },

  removeWorktree: async (tabId: string, path: string, force: boolean = false) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    try {
      await removeWorktreeIpc(tab.repoId, path, force);
      await get().fetchWorktrees(tabId);
      await get().refreshTabMetadata(tabId);
      return true;
    } catch (err) {
      console.error("Failed to remove worktree:", err);
      return false;
    }
  },

  pruneWorktrees: async (tabId: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    try {
      await pruneWorktreesIpc(tab.repoId);
      await Promise.all([
        get().fetchWorktrees(tabId),
        get().fetchBranches(tabId),
        get().refreshTabMetadata(tabId),
      ]);
      return true;
    } catch (err) {
      console.error("Failed to prune worktrees:", err);
      return false;
    }
  },

  fetchRemoteSyncStatus: async (tabId: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return null;

    try {
      const remoteSync = await getRemoteSyncStatusIpc(tab.repoId);
      get().updateTab(tabId, { remoteSync });
      return remoteSync;
    } catch (err) {
      console.warn("Failed to fetch remote sync status:", err);
      return null;
    }
  },

  fetchBranches: async (tabId: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return null;

    try {
      const branches = await getRepoBranchesIpc(tab.repoId);
      get().updateTab(tabId, { branches });
      return branches;
    } catch (err) {
      console.warn("Failed to fetch branches:", err);
      return null;
    }
  },

  checkoutBranch: async (tabId: string, branchName: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    try {
      await checkoutBranchIpc(tab.repoId, branchName);
      await get().refreshTabMetadata(tabId);
      await get().fetchBranches(tabId);
      return true;
    } catch (err) {
      console.error("Failed to checkout branch:", err);
      return false;
    }
  },

  createBranch: async (tabId: string, branchName: string, targetCommit?: string, checkout = true) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    try {
      await createBranchIpc(tab.repoId, branchName, targetCommit, checkout);
      await get().refreshTabMetadata(tabId);
      await get().fetchBranches(tabId);
      return true;
    } catch (err) {
      console.error("Failed to create branch:", err);
      showAlert({
        title: "Create Branch Failed",
        message: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return false;
    }
  },

  deleteBranch: async (tabId: string, branchName: string, isRemote = false) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    try {
      await deleteBranchIpc(tab.repoId, branchName, isRemote);
      useSharkStore.getState().recordSharkStat("chomp", 1);
      useSharkStore
        .getState()
        .triggerCelebration("chomp", `Chomped branch '${branchName}'! 🦈`);
      await get().refreshTabMetadata(tabId);
      await get().fetchBranches(tabId);
      return true;
    } catch (err) {
      console.error("Failed to delete branch:", err);
      showAlert({
        title: "Delete Branch Failed",
        message: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return false;
    }
  },

  renameBranch: async (tabId: string, oldName: string, newName: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    try {
      await renameBranchIpc(tab.repoId, oldName, newName);
      useSharkStore
        .getState()
        .triggerCelebration("chomp", `Renamed branch '${oldName}' to '${newName}'! 🦈`);
      await get().refreshTabMetadata(tabId);
      await get().fetchBranches(tabId);
      await get().fetchRemoteSyncStatus(tabId);
      return true;
    } catch (err) {
      console.error("Failed to rename branch:", err);
      showAlert({
        title: "Rename Branch Failed",
        message: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return false;
    }
  },

  fetchStashes: async (tabId: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return [];

    try {
      const stashes = await listStashesIpc(tab.repoId);
      get().updateTab(tabId, { stashes });
      return stashes;
    } catch (err) {
      console.warn("Failed to fetch stashes:", err);
      return [];
    }
  },

  createStash: async (tabId: string, message?: string, includeUntracked = true) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    try {
      await createStashIpc(tab.repoId, message, includeUntracked);
      useSharkStore.getState().recordSharkStat("stash", 1);
      await get().refreshTabMetadata(tabId);
      await get().fetchStashes(tabId);
      return true;
    } catch (err) {
      console.error("Failed to create stash:", err);
      showAlert({
        title: "Create Stash Failed",
        message: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return false;
    }
  },

  applyStash: async (tabId: string, index: number, pop = false) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    try {
      await applyStashIpc(tab.repoId, index, pop);
      await get().refreshTabMetadata(tabId);
      await get().fetchStashes(tabId);
      return true;
    } catch (err) {
      console.error("Failed to apply stash:", err);
      showAlert({
        title: "Apply Stash Failed",
        message: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return false;
    }
  },

  dropStash: async (tabId: string, index: number) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    try {
      await dropStashIpc(tab.repoId, index);
      useSharkStore.getState().recordSharkStat("chomp", 1);
      useSharkStore
        .getState()
        .triggerCelebration("chomp", `Chomped stash@{${index}}! 🦈`);
      await get().fetchStashes(tabId);
      await get().refreshTabMetadata(tabId);
      return true;
    } catch (err) {
      console.error("Failed to drop stash:", err);
      showAlert({
        title: "Drop Stash Failed",
        message: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return false;
    }
  },

  fetchStashDetails: async (tabId: string, stashIndex: number) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return null;

    try {
      return await getStashDetailsIpc(tab.repoId, stashIndex);
    } catch (err) {
      console.error(`Failed to fetch details for stash #${stashIndex}:`, err);
      showAlert({
        title: "Load Stash Failed",
        message: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return null;
    }
  },

  fetchStashFileDiff: async (tabId: string, stashIndex: number, filePath: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return null;

    try {
      return await getStashFileDiffIpc(tab.repoId, stashIndex, filePath);
    } catch (err) {
      console.error(`Failed to fetch stash file diff (${filePath}):`, err);
      showAlert({
        title: "Load Stash Diff Failed",
        message: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return null;
    }
  },

  fetchTags: async (tabId: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return [];

    try {
      const tags = await listTagsIpc(tab.repoId);
      get().updateTab(tabId, { tags });
      return tags;
    } catch (err) {
      console.warn("Failed to fetch tags:", err);
      return [];
    }
  },

  createTag: async (
    tabId: string,
    tagName: string,
    targetCommit?: string,
    message?: string,
    pushToRemote = false
  ) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    try {
      await createTagIpc(tab.repoId, tagName, targetCommit, message);
      if (pushToRemote) {
        await get().pushTag(tabId, tagName);
      }
      await get().refreshTabMetadata(tabId);
      await get().fetchTags(tabId);
      return true;
    } catch (err) {
      console.error("Failed to create tag:", err);
      showAlert({
        title: "Create Tag Failed",
        message: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return false;
    }
  },

  deleteTag: async (tabId: string, tagName: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    try {
      await deleteTagIpc(tab.repoId, tagName);
      await get().refreshTabMetadata(tabId);
      await get().fetchTags(tabId);
      return true;
    } catch (err) {
      console.error("Failed to delete tag:", err);
      showAlert({
        title: "Delete Tag Failed",
        message: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return false;
    }
  },

  pushTag: async (tabId: string, tagName: string, remote = "origin") => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    const repoId = tab.repoId;
    get().updateTab(tabId, {
      terminalOpen: true,
      hookState: {
        stage: "committing",
        status: "running",
        elapsedSeconds: 0,
        lastCommand: "push",
        exitCode: null,
        error: null,
      },
    });

    if (activeTimers.has(tabId)) {
      clearInterval(activeTimers.get(tabId)!);
      activeTimers.delete(tabId);
    }

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const currentTab = get().tabs.find((t) => t.id === tabId);
      if (currentTab?.hookState && currentTab.hookState.status === "running") {
        get().updateTab(tabId, {
          hookState: {
            ...currentTab.hookState,
            elapsedSeconds: Number(elapsed.toFixed(1)),
          },
        });
      }
    }, 100);
    activeTimers.set(tabId, timer);

    return new Promise<boolean>(async (resolve) => {
      let isDone = false;
      let unlistenExitFn: (() => void) | null = null;

      const cleanup = () => {
        if (activeTimers.has(tabId)) {
          clearInterval(activeTimers.get(tabId)!);
          activeTimers.delete(tabId);
        }
        if (unlistenExitFn) {
          unlistenExitFn();
          unlistenExitFn = null;
        }
      };

      try {
        unlistenExitFn = await listenToTerminalExit(repoId, async (payload) => {
          if (isDone) return;
          isDone = true;
          cleanup();

          const totalElapsed = (Date.now() - startTime) / 1000;

          if (payload.success) {
            get().updateTab(tabId, {
              hookState: {
                stage: "committing",
                status: "passed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "push",
                exitCode: 0,
              },
            });

            await get().refreshTabMetadata(tabId);

            setTimeout(() => {
              const checkTab = get().tabs.find((t) => t.id === tabId);
              if (checkTab?.hookState?.status === "passed") {
                get().updateTab(tabId, { terminalOpen: false });
              }
            }, 1500);

            resolve(true);
          } else {
            get().updateTab(tabId, {
              terminalOpen: true,
              hookState: {
                stage: "committing",
                status: "failed",
                elapsedSeconds: Number(totalElapsed.toFixed(1)),
                lastCommand: "push",
                exitCode: payload.exit_code ?? 1,
                error: `Push tag failed with exit code ${payload.exit_code ?? 1}`,
              },
            });
            resolve(false);
          }
        });

        await pushTagIpc(repoId, tagName, remote);
      } catch (err) {
        if (isDone) return;
        isDone = true;
        cleanup();

        get().updateTab(tabId, {
          terminalOpen: true,
          hookState: {
            stage: "committing",
            status: "failed",
            elapsedSeconds: Number(((Date.now() - startTime) / 1000).toFixed(1)),
            lastCommand: "push",
            exitCode: 1,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        resolve(false);
      }
    });
  },

  openRepoInBrowser: async (tabId: string): Promise<boolean> => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return false;

    let remoteUrl = tab.metadata?.remote_url;
    if (!remoteUrl && tab.repoId) {
      try {
        remoteUrl = await getRepositoryRemoteUrlIpc(tab.repoId);
        if (remoteUrl && tab.metadata) {
          get().updateTab(tabId, {
            metadata: { ...tab.metadata, remote_url: remoteUrl },
          });
        }
      } catch (e) {
        console.warn("Failed to query remote URL for repository:", e);
      }
    }

    if (!remoteUrl) {
      console.warn("No remote URL configured for this repository");
      return false;
    }

    const parsed = parseGitRemoteUrl(remoteUrl);
    if (!parsed) {
      console.warn("Could not parse remote URL:", remoteUrl);
      return false;
    }

    try {
      await openInBrowserIpc(parsed.repoWebUrl);
      return true;
    } catch (e) {
      console.error("Failed to open repository in browser:", e);
      return false;
    }
  },

  createPullRequestInBrowser: async (tabId: string, branchName?: string): Promise<boolean> => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return false;

    let remoteUrl = tab.metadata?.remote_url;
    if (!remoteUrl && tab.repoId) {
      try {
        remoteUrl = await getRepositoryRemoteUrlIpc(tab.repoId);
        if (remoteUrl && tab.metadata) {
          get().updateTab(tabId, {
            metadata: { ...tab.metadata, remote_url: remoteUrl },
          });
        }
      } catch (e) {
        console.warn("Failed to query remote URL for repository:", e);
      }
    }

    if (!remoteUrl) {
      console.warn("No remote URL configured for this repository");
      return false;
    }

    const parsed = parseGitRemoteUrl(remoteUrl);
    if (!parsed) {
      console.warn("Could not parse remote URL:", remoteUrl);
      return false;
    }

    const targetBranch =
      branchName ||
      tab.metadata?.current_branch ||
      tab.branches?.local?.find((b) => b.is_head)?.shorthand ||
      undefined;
    const prUrl = parsed.createPrUrl(targetBranch);

    // Record XP and trigger celebration immediately so user actions are always rewarded
    useSharkStore.getState().recordSharkStat("pr", 1);
    useSharkStore
      .getState()
      .triggerCelebration("swim", "Pull Request Launched! (+10 XP) 🦈");

    try {
      await openInBrowserIpc(prUrl);
      return true;
    } catch (e) {
      console.warn("openInBrowserIpc failed, attempting browser window.open fallback:", e);
      try {
        window.open(prUrl, "_blank");
      } catch {}
      return true;
    }
  },

  fetchPullRequests: async (tabId: string): Promise<PullRequestInfo[]> => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return [];

    let remoteUrl = tab.metadata?.remote_url;
    if (!remoteUrl) {
      try {
        remoteUrl = await getRepositoryRemoteUrlIpc(tab.repoId);
        if (remoteUrl && tab.metadata) {
          get().updateTab(tabId, {
            metadata: { ...tab.metadata, remote_url: remoteUrl },
          });
        }
      } catch {
        // optional remote URL query
      }
    }

    if (!remoteUrl) return [];

    try {
      const pullRequests = await fetchRepoPullRequests(remoteUrl);
      get().updateTab(tabId, { pullRequests });
      return pullRequests;
    } catch (err) {
      console.warn("Failed to fetch pull requests:", err);
      return [];
    }
  },

  fetchBranchComparison: async (
    tabId: string,
    baseRef: string,
    compareRef: string,
    includeUncommitted?: boolean
  ) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return null;

    try {
      return await getBranchComparisonIpc(tab.repoId, baseRef, compareRef, includeUncommitted);
    } catch (err) {
      console.error(`Failed to compare branches ${baseRef}...${compareRef}:`, err);
      showAlert({
        title: "Branch Comparison Failed",
        message: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return null;
    }
  },

  fetchBranchComparisonFileDiff: async (
    tabId: string,
    baseRef: string,
    compareRef: string,
    filePath: string,
    includeUncommitted?: boolean
  ) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return null;

    try {
      return await getBranchComparisonFileDiffIpc(
        tab.repoId,
        baseRef,
        compareRef,
        filePath,
        includeUncommitted
      );
    } catch (err) {
      console.error(`Failed to fetch branch comparison file diff (${filePath}):`, err);
      showAlert({
        title: "Load Comparison Diff Failed",
        message: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return null;
    }
  },

  openInPrView: (tabId: string, compareBranch?: string, baseBranch?: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const currentBranch = tab.metadata?.current_branch || "main";
    const hasMain =
      tab.branches?.local.some((b) => b.shorthand === "main") ||
      tab.branches?.remote.some((b) => b.shorthand.endsWith("/main"));
    const hasMaster =
      tab.branches?.local.some((b) => b.shorthand === "master") ||
      tab.branches?.remote.some((b) => b.shorthand.endsWith("/master"));
    const detectedDefault = hasMain ? "main" : hasMaster ? "master" : "main";

    const defaultBase = baseBranch || detectedDefault;
    const defaultCompare = compareBranch || currentBranch;
    get().updateTab(tabId, {
      activeView: "pr",
      prCompareBase: defaultBase,
      prCompareTarget: defaultCompare,
      prSelectedFile: null,
    });
  },
}));
