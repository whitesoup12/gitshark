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
} from "@/types";
import {
  openRepositoryIpc,
  closeRepositoryIpc,
  getRepositoryMetadataIpc,
  pickRepositoryDirectory,
  executeGitCommitIpc,
  executeGitPushIpc,
  executeGitPullIpc,
  cancelActiveProcessIpc,
  getRepoHooksIpc,
  listWorktreesIpc,
  addWorktreeIpc,
  removeWorktreeIpc,
  getRemoteSyncStatusIpc,
  getRepoBranchesIpc,
  checkoutBranchIpc,
  createBranchIpc,
  deleteBranchIpc,
  listStashesIpc,
  createStashIpc,
  applyStashIpc,
  dropStashIpc,
  listenToTerminalExit,
  listenToTerminalData,
} from "@/lib/ipc";

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

  // Hook & Process Orchestration
  fetchRepoHooks: (tabId: string) => Promise<RepoHooksInfo | null>;
  executeCommit: (tabId: string, message: string, amend?: boolean) => Promise<boolean>;
  executePush: (
    tabId: string,
    remote?: string,
    branch?: string,
    force?: boolean,
    setUpstream?: boolean
  ) => Promise<boolean>;
  executePull: (tabId: string, remote?: string, branch?: string, rebase?: boolean) => Promise<boolean>;
  cancelActiveProcess: (tabId: string) => Promise<void>;
  retryLastHook: (tabId: string) => Promise<void>;
  dismissHookStatus: (tabId: string) => void;

  // Milestone 5: Worktrees & Remote Sync
  fetchWorktrees: (tabId: string) => Promise<WorktreeItem[]>;
  addWorktree: (tabId: string, path: string, branch: string, newBranch?: boolean) => Promise<boolean>;
  removeWorktree: (tabId: string, path: string, force?: boolean) => Promise<boolean>;
  fetchRemoteSyncStatus: (tabId: string) => Promise<RemoteSyncStatus | null>;

  // Branches
  fetchBranches: (tabId: string) => Promise<RepoBranches | null>;
  checkoutBranch: (tabId: string, branchName: string) => Promise<boolean>;
  createBranch: (tabId: string, branchName: string, targetCommit?: string, checkout?: boolean) => Promise<boolean>;
  deleteBranch: (tabId: string, branchName: string, isRemote?: boolean) => Promise<boolean>;

  // Stashes
  fetchStashes: (tabId: string) => Promise<StashItem[]>;
  createStash: (tabId: string, message?: string, includeUntracked?: boolean) => Promise<boolean>;
  applyStash: (tabId: string, index: number, pop?: boolean) => Promise<boolean>;
  dropStash: (tabId: string, index: number) => Promise<boolean>;
}

// Module-level timers map for elapsed stopwatch per tab
const activeTimers = new Map<string, ReturnType<typeof setInterval>>();

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  cloneModalOpen: false,

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
  },

  setActiveTab: (tabId: string) => {
    set({ activeTabId: tabId });
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
      get().updateTab(tabId, {
        metadata,
        title: metadata.name,
      });

      // Also refresh remote sync, worktrees, and branches
      get().fetchRemoteSyncStatus(tabId);
      get().fetchWorktrees(tabId);
      get().fetchBranches(tabId);
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

  retryLastHook: async (tabId: string) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab?.hookState) return;
    const { lastCommand, lastMessage, lastAmend } = tab.hookState;
    if (lastCommand === "commit" && lastMessage !== undefined) {
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
      return true;
    } catch (err) {
      console.error("Failed to remove worktree:", err);
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
      alert(err instanceof Error ? err.message : String(err));
      return false;
    }
  },

  deleteBranch: async (tabId: string, branchName: string, isRemote = false) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    try {
      await deleteBranchIpc(tab.repoId, branchName, isRemote);
      await get().refreshTabMetadata(tabId);
      await get().fetchBranches(tabId);
      return true;
    } catch (err) {
      console.error("Failed to delete branch:", err);
      alert(err instanceof Error ? err.message : String(err));
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
      await get().refreshTabMetadata(tabId);
      await get().fetchStashes(tabId);
      return true;
    } catch (err) {
      console.error("Failed to create stash:", err);
      alert(err instanceof Error ? err.message : String(err));
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
      alert(err instanceof Error ? err.message : String(err));
      return false;
    }
  },

  dropStash: async (tabId: string, index: number) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.repoId) return false;

    try {
      await dropStashIpc(tab.repoId, index);
      await get().fetchStashes(tabId);
      return true;
    } catch (err) {
      console.error("Failed to drop stash:", err);
      alert(err instanceof Error ? err.message : String(err));
      return false;
    }
  },
}));
