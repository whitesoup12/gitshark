import React, { useState, useEffect, useMemo } from "react";
import { Tab } from "@/types";
import {
  GitBranch,
  FolderGit2,
  Bookmark,
  Archive,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  RefreshCw,
  FolderTree,
  Folder,
  FolderOpen,
  ShieldCheck,
  Globe,
  ArrowUp,
  ArrowDown,
  Cloud,
  Plus,
  Play,
  Trash2,
  Loader2,
  Settings,
  GitPullRequest,
  Layers,
  AlertTriangle,
  Edit3,
  Sparkles,
} from "lucide-react";
import { useUpdateStore } from "@/store/useUpdateStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { WorktreeSection } from "./WorktreeSection";
import { StashSection } from "./StashSection";
import { TagSection } from "./TagSection";
import { BranchContextMenu } from "./BranchContextMenu";
import { DeleteBranchModal } from "./DeleteBranchModal";
import { RenameBranchModal } from "./RenameBranchModal";
import type { BranchItem, PullRequestInfo, WorktreeItem } from "@/types";
import { APP_VERSION } from "@/constants/version";
import { listenToStatusChanged, openInBrowserIpc } from "@/lib/ipc";


interface SidebarProps {
  tab: Tab;
}

export const Sidebar: React.FC<SidebarProps> = ({ tab }) => {
  const {
    refreshTabMetadata,
    checkoutBranch,
    createBranch,
    deleteBranch,
    renameBranch,
    executePull,
    executePush,
    executeFetch,
    executeMerge,
    fetchRemoteSyncStatus,
    fetchBranches,
    createPullRequestInBrowser,
    executeHookDryRun,
    setActiveView,
    updateTab,
    openInPrView,
    pruneWorktrees,
    openRepositoryTab,
    openRepoInBrowser,
    removeWorktree,
    fetchWorktrees,
  } = useWorkspaceStore();

  const openSettings = useSettingsStore((s) => s.openSettings);
  const { hasUpdate, latestVersion, releaseUrl } = useUpdateStore();

  interface SidebarSectionsState {
    branches: boolean;
    remotes: boolean;
    stashes: boolean;
    worktrees: boolean;
    tags: boolean;
    hooks: boolean;
  }

  const [sectionsOpen, setSectionsOpen] = useState<SidebarSectionsState>(() => {
    const defaults: SidebarSectionsState = {
      branches: true,
      remotes: false,
      stashes: false,
      worktrees: false,
      tags: false,
      hooks: false,
    };
    try {
      const saved = localStorage.getItem("gitshark_sidebar_sections_v2");
      if (saved) {
        return { ...defaults, ...JSON.parse(saved) };
      }
    } catch {}
    return defaults;
  });

  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [createBranchBase, setCreateBranchBase] = useState<BranchItem | null>(null);
  const [newBranchName, setNewBranchName] = useState("");
  const [checkoutNewBranch, setCheckoutNewBranch] = useState(true);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [isFetchingRemote, setIsFetchingRemote] = useState(false);

  // Branch pagination and remote fork dropdown states
  const [showAllLocal, setShowAllLocal] = useState(false);
  const [openRemoteForks, setOpenRemoteForks] = useState<Record<string, boolean>>({ origin: true });
  const [showAllRemoteForks, setShowAllRemoteForks] = useState<Record<string, boolean>>({});
  const [openRemoteFolders, setOpenRemoteFolders] = useState<Record<string, boolean>>({});

  // Sync states for Repo Header icon buttons
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isFetchingSync, setIsFetchingSync] = useState(false);

  const sync = tab.remoteSync;
  const ahead = sync?.ahead ?? 0;
  const behind = sync?.behind ?? 0;
  const hasUpstream = sync?.has_upstream ?? false;

  const isHookPushing = tab.hookState?.status === "running" && tab.hookState?.lastCommand === "push";
  const isHookPulling = tab.hookState?.status === "running" && tab.hookState?.lastCommand === "pull";
  const isHookFetching = tab.hookState?.status === "running" && tab.hookState?.lastCommand === "fetch";
  const isHookRunning = tab.hookState?.status === "running";

  const effectivePushing = isPushing || isHookPushing;
  const effectivePulling = isPulling || isHookPulling;
  const effectiveFetching = isFetchingSync || isHookFetching;
  const isSyncBusy = effectivePulling || effectivePushing || effectiveFetching || isHookRunning;

  const handleHeaderPull = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!tab.repoId || isSyncBusy) return;
    setIsPulling(true);
    try {
      await executePull(tab.id);
      await fetchRemoteSyncStatus(tab.id);
      await fetchBranches(tab.id);
      await refreshTabMetadata(tab.id);
    } catch (err) {
      console.warn("Pull failed:", err);
    } finally {
      setIsPulling(false);
    }
  };

  const handleHeaderPush = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!tab.repoId || isSyncBusy) return;
    setIsPushing(true);
    try {
      await executePush(tab.id, undefined, undefined, false, !hasUpstream);
      await fetchRemoteSyncStatus(tab.id);
      await fetchBranches(tab.id);
      await refreshTabMetadata(tab.id);
    } catch (err) {
      console.warn("Push failed:", err);
    } finally {
      setIsPushing(false);
    }
  };

  const handleHeaderFetch = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!tab.repoId || isSyncBusy) return;
    setIsFetchingSync(true);
    try {
      await executeFetch(tab.id, undefined, true);
      await fetchRemoteSyncStatus(tab.id);
      await fetchBranches(tab.id);
      await refreshTabMetadata(tab.id);
    } catch (err) {
      console.warn("Fetch failed:", err);
    } finally {
      setIsFetchingSync(false);
    }
  };

  const currentBranchName = tab.metadata?.current_branch;
  const activeBranchPr = currentBranchName
    ? (tab.pullRequests || []).find((pr) => pr.source_branch === currentBranchName)
    : null;
  const [contextMenu, setContextMenu] = useState<{
    branch: BranchItem;
    activePr?: PullRequestInfo | null;
    linkedWorktree?: WorktreeItem | null;
    x: number;
    y: number;
  } | null>(null);

  // Resizable sidebar width with persistence
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem("gitshark_sidebar_width");
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 180 && parsed <= 650) {
        return parsed;
      }
    }
    return 256;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  const handleSidebarResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.min(Math.max(startWidth + delta, 180), 650);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsResizingSidebar(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      const delta = upEvent.clientX - startX;
      const finalWidth = Math.min(Math.max(startWidth + delta, 180), 650);
      localStorage.setItem("gitshark_sidebar_width", String(finalWidth));
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleResetSidebarWidth = () => {
    setSidebarWidth(256);
    localStorage.setItem("gitshark_sidebar_width", "256");
  };

  // Real-time listener for working tree changes / commits / branch switches
  useEffect(() => {
    if (!tab.repoId) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let unlisten: (() => void) | null = null;

    listenToStatusChanged(tab.repoId, () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        fetchBranches(tab.id);
        fetchRemoteSyncStatus(tab.id);
      }, 300);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (unlisten) unlisten();
    };
  }, [tab.repoId, tab.id, fetchBranches, fetchRemoteSyncStatus]);

  const toggleSection = (key: keyof typeof sectionsOpen) => {
    setSectionsOpen((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("gitshark_sidebar_sections_v2", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim() || isCreatingBranch) return;

    setIsCreatingBranch(true);
    try {
      const targetCommit = createBranchBase?.target_commit ?? undefined;
      const success = await createBranch(
        tab.id,
        newBranchName.trim(),
        targetCommit,
        checkoutNewBranch
      );
      if (success) {
        setNewBranchName("");
        setIsAddingBranch(false);
        setCreateBranchBase(null);
      }
    } finally {
      setIsCreatingBranch(false);
    }
  };

  const [branchToDelete, setBranchToDelete] = useState<{
    branchName: string;
    isRemote: boolean;
  } | null>(null);
  const [isDeletingBranch, setIsDeletingBranch] = useState(false);

  const promptDeleteBranch = (branchName: string, isRemote = false) => {
    if (!tab.worktrees) {
      fetchWorktrees(tab.id);
    }
    setBranchToDelete({ branchName, isRemote });
  };

  const confirmDeleteBranch = async (options?: { removeWorktreePath?: string }) => {
    if (!branchToDelete || isDeletingBranch) return;
    setIsDeletingBranch(true);
    try {
      if (options?.removeWorktreePath) {
        const removed = await removeWorktree(tab.id, options.removeWorktreePath, true);
        if (!removed) return;
        await pruneWorktrees(tab.id);
      }
      const success = await deleteBranch(tab.id, branchToDelete.branchName, branchToDelete.isRemote);
      if (success) {
        setBranchToDelete(null);
      }
    } finally {
      setIsDeletingBranch(false);
    }
  };

  const [branchToRename, setBranchToRename] = useState<BranchItem | null>(null);
  const [isRenamingBranch, setIsRenamingBranch] = useState(false);

  const handlePullBranch = async (branch: BranchItem) => {
    if (branch.is_remote) {
      const remoteName = branch.shorthand.split("/")[0] || "origin";
      await executeFetch(tab.id, remoteName);
    } else {
      await executePull(tab.id, undefined, branch.shorthand);
    }
  };

  const handlePushBranch = async (branch: BranchItem) => {
    await executePush(tab.id, undefined, branch.shorthand);
  };

  const handleFetch = async () => {
    await executeFetch(tab.id);
  };

  const handleMergeBranch = async (branch: BranchItem) => {
    await executeMerge(tab.id, branch.shorthand);
  };

  const handleCheckoutBranch = async (branch: BranchItem) => {
    await checkoutBranch(tab.id, branch.shorthand);
  };

  const handleSelectBranchCommit = (branch: BranchItem) => {
    setActiveView(tab.id, "graph");
    if (branch.target_commit) {
      updateTab(tab.id, { selectedCommitHash: branch.target_commit });
    }
  };

  const metadata = tab.metadata;
  const currentBranch = metadata?.current_branch ?? (metadata?.is_detached ? "Detached HEAD" : "No branch");

  const localBranches = tab.branches?.local ?? (currentBranch ? [{
    name: `refs/heads/${currentBranch}`,
    shorthand: currentBranch,
    is_head: true,
    is_remote: false,
    upstream: null,
    target_commit: null,
  }] : []);

  const remoteBranches = tab.branches?.remote ?? [];

  // Sorted local branches: active HEAD branch first, then alphabetical
  const sortedLocalBranches = useMemo(() => {
    return [...localBranches].sort((a, b) => {
      const aIsCurrent = a.is_head || a.shorthand === currentBranch;
      const bIsCurrent = b.is_head || b.shorthand === currentBranch;
      if (aIsCurrent) return -1;
      if (bIsCurrent) return 1;
      return a.shorthand.localeCompare(b.shorthand);
    });
  }, [localBranches, currentBranch]);

  const visibleLocalBranches = showAllLocal
    ? sortedLocalBranches
    : sortedLocalBranches.slice(0, 10);

  interface RemoteBranchEntry {
    branch: BranchItem;
    remoteName: string;
    subPath: string;
    folder: string | null;
    leafName: string;
  }

  interface RemoteForkGroup {
    name: string;
    branches: RemoteBranchEntry[];
    folders: Record<string, RemoteBranchEntry[]>;
    rootBranches: RemoteBranchEntry[];
  }

  const remoteForkGroups = useMemo<RemoteForkGroup[]>(() => {
    const forkMap: Record<string, RemoteBranchEntry[]> = {};

    for (const b of remoteBranches) {
      const slashIndex = b.shorthand.indexOf("/");
      const remoteName = slashIndex > -1 ? b.shorthand.slice(0, slashIndex) : "origin";
      const subPath = slashIndex > -1 ? b.shorthand.slice(slashIndex + 1) : b.shorthand;

      const subSlashIndex = subPath.indexOf("/");
      const folder = subSlashIndex > -1 ? subPath.slice(0, subSlashIndex) : null;
      const leafName = subSlashIndex > -1 ? subPath.slice(subSlashIndex + 1) : subPath;

      if (!forkMap[remoteName]) {
        forkMap[remoteName] = [];
      }
      forkMap[remoteName].push({
        branch: b,
        remoteName,
        subPath,
        folder,
        leafName,
      });
    }

    const sortedForkNames = Object.keys(forkMap).sort((a, b) => {
      if (a === "origin") return -1;
      if (b === "origin") return 1;
      return a.localeCompare(b);
    });

    return sortedForkNames.map((name) => {
      const branches = forkMap[name];
      const folders: Record<string, RemoteBranchEntry[]> = {};
      const rootBranches: RemoteBranchEntry[] = [];

      for (const entry of branches) {
        if (entry.folder) {
          if (!folders[entry.folder]) {
            folders[entry.folder] = [];
          }
          folders[entry.folder].push(entry);
        } else {
          rootBranches.push(entry);
        }
      }

      rootBranches.sort((a, b) => a.leafName.localeCompare(b.leafName));

      for (const folder of Object.keys(folders)) {
        folders[folder].sort((a, b) => a.leafName.localeCompare(b.leafName));
      }

      return {
        name,
        branches,
        folders,
        rootBranches,
      };
    });
  }, [remoteBranches]);

  const renderRemoteBranchRow = (
    branch: BranchItem,
    displayName: string,
    indent = false
  ) => (
    <div
      key={branch.name}
      onClick={() => handleSelectBranchCommit(branch)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
          branch,
          x: e.clientX,
          y: e.clientY,
        });
      }}
      className={`group flex items-center justify-between px-2 py-1 rounded text-slate-400 hover:text-slate-200 hover:bg-shark-800/60 cursor-pointer transition-colors ${
        indent ? "pl-4" : ""
      }`}
      title={`Click to view '${branch.shorthand}' in graph (right-click for actions)`}
    >
      <div className="flex items-center gap-2 truncate flex-1 mr-2">
        <Globe className="w-3 h-3 text-indigo-400 flex-shrink-0" />
        <span className="truncate text-xs font-mono">{displayName}</span>
      </div>
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCheckoutBranch(branch);
          }}
          className="text-[10px] text-slate-400 hover:text-indigo-300 hover:bg-indigo-950/70 px-1 py-0.5 rounded border border-transparent hover:border-indigo-800/50 transition-colors font-mono"
          title={`Checkout local branch from '${branch.shorthand}'`}
        >
          checkout
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            promptDeleteBranch(branch.shorthand, true);
          }}
          className="p-0.5 rounded text-slate-400 hover:text-rose-400 hover:bg-shark-750 transition-colors"
          title={`Delete remote branch '${branch.shorthand}'`}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );

  return (
    <aside
      style={{
        width: tab.sidebarCollapsed ? 48 : sidebarWidth,
      }}
      className={`flex flex-col bg-shark-900 border-r border-shark-800 select-none h-full relative flex-shrink-0 ${
        isResizingSidebar ? "" : "transition-[width] duration-200"
      }`}
    >
      {/* Draggable resize handle on right border for wide branch name visibility */}
      {!tab.sidebarCollapsed && (
        <div
          onMouseDown={handleSidebarResizeMouseDown}
          onDoubleClick={handleResetSidebarWidth}
          className="absolute top-0 -right-1 w-2 h-full cursor-col-resize hover:bg-sky-500/30 active:bg-sky-500/50 transition-colors z-20 group"
          title="Drag to resize sidebar for full branch names (Double-click to reset)"
        >
          <div className="w-[1px] h-full mx-auto bg-transparent group-hover:bg-sky-400/80 transition-colors" />
        </div>
      )}

      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3 h-11 border-b border-shark-800">
        <div className="flex items-center gap-2 truncate">
          <FolderGit2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
          {!tab.sidebarCollapsed && (
            <div className="truncate">
              <div className="text-xs font-bold text-slate-100 truncate">
                {metadata?.name ?? tab.title}
              </div>
              <div
                className="text-[10px] text-slate-400 font-mono truncate"
                title={metadata?.path ?? tab.path ?? ""}
              >
                {metadata?.path ?? tab.path}
              </div>
            </div>
          )}
        </div>

        {!tab.sidebarCollapsed && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* Pull Icon Button */}
            <button
              onClick={handleHeaderPull}
              disabled={isSyncBusy}
              className={`relative flex items-center justify-center w-7 h-7 rounded transition-colors ${
                behind > 0
                  ? "bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 hover:bg-indigo-900/80 shadow-sm"
                  : "text-slate-400 hover:text-slate-100 hover:bg-shark-800"
              } disabled:opacity-50`}
              title={
                behind > 0
                  ? `${behind} commits behind remote. Click to pull (git pull).`
                  : "Pull changes from remote (git pull)"
              }
            >
              <ArrowDown className={`w-3.5 h-3.5 text-indigo-400 ${effectivePulling ? "animate-bounce" : ""}`} />
              {behind > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full text-[9px] font-mono font-bold bg-indigo-500 text-white flex items-center justify-center leading-none shadow-sm">
                  {behind}
                </span>
              )}
            </button>

            {/* Push Icon Button */}
            <button
              onClick={handleHeaderPush}
              disabled={isSyncBusy}
              className={`relative flex items-center justify-center w-7 h-7 rounded transition-colors ${
                ahead > 0
                  ? "bg-sky-950/80 text-sky-300 border border-sky-700/60 hover:bg-sky-900/80 shadow-sm"
                  : "text-slate-400 hover:text-slate-100 hover:bg-shark-800"
              } disabled:opacity-50`}
              title={
                !hasUpstream
                  ? "Publish current branch to remote (git push --set-upstream)"
                  : ahead > 0
                  ? `${ahead} commits ahead of remote. Click to push (git push).`
                  : "Push local commits to remote (git push)"
              }
            >
              {!hasUpstream ? (
                <Cloud className={`w-3.5 h-3.5 text-sky-400 ${effectivePushing ? "animate-pulse" : ""}`} />
              ) : (
                <ArrowUp className={`w-3.5 h-3.5 text-sky-400 ${effectivePushing ? "animate-bounce" : ""}`} />
              )}
              {ahead > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full text-[9px] font-mono font-bold bg-sky-500 text-white flex items-center justify-center leading-none shadow-sm">
                  {ahead}
                </span>
              )}
            </button>

            {/* Fetch / Sync Icon Button */}
            <button
              onClick={handleHeaderFetch}
              disabled={isSyncBusy}
              className="flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:text-slate-100 hover:bg-shark-800 transition-colors disabled:opacity-50"
              title="Fetch remote & refresh repository status"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  effectiveFetching || effectivePulling || effectivePushing ? "animate-spin text-sky-400" : ""
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {/* Collapsed view icon list */}
      {tab.sidebarCollapsed ? (
        <div className="flex flex-col items-center py-4 gap-4 text-slate-400">
          <span title="Branches"><GitBranch className="w-4 h-4 hover:text-sky-400 cursor-pointer" /></span>
          <span title="Worktrees"><FolderTree className="w-4 h-4 hover:text-sky-400 cursor-pointer" /></span>
          <span title="Stashes"><Archive className="w-4 h-4 hover:text-sky-400 cursor-pointer" /></span>
          <span title="Tags"><Bookmark className="w-4 h-4 hover:text-sky-400 cursor-pointer" /></span>
        </div>
      ) : (
        /* Expanded full sidebar content */
        <div className="flex-1 overflow-y-auto mr-2 px-2 py-3 space-y-4 text-xs">
          {/* Section: Local Branches */}
          <div>
            <div className="flex items-center justify-between w-full px-1.5 py-1 text-slate-300 font-medium select-none group">
              <button
                onClick={() => toggleSection("branches")}
                className="flex items-center gap-1.5 hover:text-slate-100 flex-1 text-left"
              >
                {sectionsOpen.branches ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                <span>Local Branches</span>
                <span className="text-[10px] text-slate-500 font-mono">({localBranches.length})</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!sectionsOpen.branches) toggleSection("branches");
                  setCreateBranchBase(null);
                  setIsAddingBranch((prev) => !prev);
                }}
                className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-shark-800 transition-colors"
                title="Create New Branch from current HEAD"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {sectionsOpen.branches && (
              <div className="mt-1 space-y-0.5 pl-2">
                {/* Create Branch Form */}
                {isAddingBranch && (
                  <form
                    onSubmit={handleCreateBranch}
                    className="p-2.5 bg-shark-950 border border-sky-600/40 rounded-lg space-y-2 mb-2 text-xs select-none shadow-md"
                  >
                    <div className="text-[11px] font-bold text-sky-300 flex items-center justify-between">
                      <div className="flex items-center gap-1 truncate">
                        <GitBranch className="w-3 h-3 text-sky-400" />
                        <span>New Branch</span>
                      </div>
                      {createBranchBase && (
                        <span
                          className="text-[10px] text-slate-400 font-mono font-normal truncate max-w-[240px]"
                          title={`Branching from '${createBranchBase.shorthand}'`}
                        >
                          from: {createBranchBase.shorthand}
                        </span>
                      )}
                    </div>

                    <input
                      type="text"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder={
                        createBranchBase
                          ? `Branch name from ${createBranchBase.shorthand}`
                          : "Branch name (e.g. feature/my-branch)"
                      }
                      className="w-full px-2 py-1 bg-shark-900 border border-shark-750 focus:border-sky-500 rounded text-[11px] font-mono text-slate-200 outline-none"
                      autoFocus
                      required
                    />

                    <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checkoutNewBranch}
                        onChange={(e) => setCheckoutNewBranch(e.target.checked)}
                        className="rounded bg-shark-900 border-shark-700 text-sky-500"
                      />
                      <span>Checkout immediately</span>
                    </label>

                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingBranch(false);
                          setCreateBranchBase(null);
                        }}
                        className="px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-slate-200 hover:bg-shark-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!newBranchName.trim() || isCreatingBranch}
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-medium text-[10px]"
                      >
                        {isCreatingBranch ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <span>Create</span>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {visibleLocalBranches.map((branch) => {
                  const isCurrent = branch.is_head || branch.shorthand === currentBranch;
                  const hasUncommitted = (isCurrent && (metadata?.is_dirty || (metadata?.staged_count ?? 0) + (metadata?.unstaged_count ?? 0) + (metadata?.untracked_count ?? 0) > 0)) || Boolean(branch.has_uncommitted);
                  const aheadCount = isCurrent && tab.remoteSync ? tab.remoteSync.ahead : (branch.ahead ?? 0);
                  const behindCount = isCurrent && tab.remoteSync ? tab.remoteSync.behind : (branch.behind ?? 0);
                  const activePr = (tab.pullRequests || []).find((pr) => pr.source_branch === branch.shorthand);
                  const linkedWorktree = (tab.worktrees || []).find((w) => !w.is_main && w.branch === branch.shorthand);

                  return (
                    <div
                      key={branch.name}
                      onClick={() => handleSelectBranchCommit(branch)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({
                          branch,
                          activePr,
                          linkedWorktree,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${
                        isCurrent
                          ? "bg-sky-950/40 text-sky-300 border border-sky-800/40 font-medium"
                          : "text-slate-400 hover:text-slate-200 hover:bg-shark-800/60 border border-transparent"
                      }`}
                      title={isCurrent ? "Current branch (click to view in graph, right-click for actions)" : `Click to view '${branch.shorthand}' in graph (right-click for actions)`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 mr-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            isCurrent
                              ? hasUncommitted
                                ? "bg-amber-400 animate-pulse"
                                : "bg-sky-400"
                              : hasUncommitted
                              ? "bg-amber-400"
                              : "bg-slate-600 group-hover:bg-slate-400"
                          }`}
                        />
                        <span className="truncate">{branch.shorthand}</span>
                      </div>

                      {/* Branch Status Indicators: uncommitted, pull (behind), push (ahead), PR, worktree */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* 1. Uncommitted working tree changes */}
                        {hasUncommitted && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-amber-950/80 border border-amber-800/60 text-amber-300"
                            title="Uncommitted changes in working tree"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            <span>dirty</span>
                          </span>
                        )}

                        {/* 2. New changes to pull (behind remote) */}
                        {behindCount > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-sky-950/80 border border-sky-800/60 text-sky-400"
                            title={`${behindCount} commit${behindCount > 1 ? "s" : ""} to pull from remote`}
                          >
                            <ArrowDown className="w-2.5 h-2.5 text-sky-400" />
                            <span>{behindCount}</span>
                          </span>
                        )}

                        {/* 3. Changes committed but not pushed (ahead of remote) */}
                        {aheadCount > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-emerald-950/80 border border-emerald-800/60 text-emerald-300"
                            title={`${aheadCount} commit${aheadCount > 1 ? "s" : ""} to push to remote`}
                          >
                            <ArrowUp className="w-2.5 h-2.5 text-emerald-400" />
                            <span>{aheadCount}</span>
                          </span>
                        )}

                        {/* 4. Active Pull Request badge */}
                        {activePr && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openInBrowserIpc(activePr.url);
                            }}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium transition-colors ${
                              activePr.is_draft
                                ? "bg-slate-800/80 text-slate-300 border border-slate-700/60 hover:bg-slate-750 hover:text-slate-100"
                                : "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/80 hover:text-emerald-200"
                            }`}
                            title={`Pull Request #${activePr.number}: ${activePr.title}${activePr.is_draft ? " (Draft)" : ""} — Click to open in browser`}
                          >
                            <GitPullRequest className="w-2.5 h-2.5" />
                            <span>#{activePr.number}</span>
                          </button>
                        )}

                        {/* 5. Linked Worktree / Orphaned status */}
                        {linkedWorktree && (
                          linkedWorktree.is_prunable ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                pruneWorktrees(tab.id);
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-rose-950/80 border border-rose-800/60 text-rose-300 hover:bg-rose-900/80 transition-colors"
                              title={`Worktree directory '${linkedWorktree.path}' is missing on disk. Click to prune orphaned worktree and unlock branch.`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                              <span>orphaned worktree</span>
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openRepositoryTab(linkedWorktree.path);
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-slate-800/80 border border-slate-700/60 text-sky-300 hover:bg-slate-750 hover:text-sky-200 transition-colors"
                              title={`Checked out in worktree at '${linkedWorktree.path}'. Click to open in a new tab.`}
                            >
                              <Layers className="w-2.5 h-2.5 text-sky-400" />
                              <span>worktree</span>
                            </button>
                          )
                        )}

                        {/* HEAD badge if current */}
                        {isCurrent && (
                          <span className="text-[10px] text-sky-400/80 font-mono font-semibold">HEAD</span>
                        )}

                        {/* Hover actions: Rename for unpushed branches, Checkout & Delete for non-current */}
                        <div className="flex items-center gap-1">
                          {!branch.upstream && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setBranchToRename(branch);
                              }}
                              className="p-1 rounded text-slate-500 hover:text-sky-300 hover:bg-shark-800 opacity-0 group-hover:opacity-100 transition-all"
                              title={`Rename local branch '${branch.shorthand}'`}
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                          {!isCurrent && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (linkedWorktree?.is_prunable) {
                                    pruneWorktrees(tab.id);
                                  } else {
                                    handleCheckoutBranch(branch);
                                  }
                                }}
                                className={`text-[10px] opacity-0 group-hover:opacity-100 px-1 py-0.5 rounded border transition-all font-mono ${
                                  linkedWorktree?.is_prunable
                                    ? "text-rose-400 hover:text-rose-300 hover:bg-rose-950/70 border-rose-800/50"
                                    : "text-slate-400 hover:text-sky-300 hover:bg-sky-950/70 border-transparent hover:border-sky-800/50"
                                }`}
                                title={
                                  linkedWorktree?.is_prunable
                                    ? `Branch locked by orphaned worktree at '${linkedWorktree.path}'. Click to prune and unlock.`
                                    : `Checkout branch '${branch.shorthand}'`
                                }
                              >
                                {linkedWorktree?.is_prunable ? "prune & unlock" : "checkout"}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  promptDeleteBranch(branch.shorthand);
                                }}
                                className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-shark-800 opacity-0 group-hover:opacity-100 transition-all"
                                title={`Delete branch '${branch.shorthand}'`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {localBranches.length > 10 && (
                  <button
                    onClick={() => setShowAllLocal((prev) => !prev)}
                    className="w-full flex items-center justify-center gap-1.5 py-1 px-2 mt-1 rounded text-[11px] font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-950/40 border border-dashed border-sky-850 hover:border-sky-700/60 transition-all select-none"
                  >
                    {showAllLocal ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        <span>Show Less</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        <span>View All ({localBranches.length})</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Section: Remote Branches */}
          <div>
            <div className="flex items-center justify-between w-full px-1.5 py-1 text-slate-300 hover:text-slate-100 font-medium group">
              <button
                onClick={() => toggleSection("remotes")}
                className="flex items-center gap-1.5 flex-1 text-left"
              >
                {sectionsOpen.remotes ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                <span>Remote Branches</span>
                <span className="text-[10px] text-slate-500">({remoteBranches.length})</span>
              </button>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await executePull(tab.id);
                    await fetchRemoteSyncStatus(tab.id);
                    await fetchBranches(tab.id);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-shark-800 transition-colors"
                  title="Pull changes from remote (git pull)"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await executePush(tab.id);
                    await fetchRemoteSyncStatus(tab.id);
                    await fetchBranches(tab.id);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-shark-800 transition-colors"
                  title="Push commits to remote (git push)"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (isFetchingRemote) return;
                    setIsFetchingRemote(true);
                    try {
                      await executeFetch(tab.id, undefined, true);
                    } finally {
                      setIsFetchingRemote(false);
                    }
                  }}
                  disabled={isFetchingRemote}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors"
                  title="Fetch and prune remote branches (git fetch --prune)"
                >
                  <RefreshCw className={`w-3 h-3 ${isFetchingRemote ? "animate-spin text-sky-400" : ""}`} />
                </button>
              </div>
            </div>
            {sectionsOpen.remotes && (
              <div className="mt-1 space-y-1 pl-1">
                {remoteForkGroups.length === 0 ? (
                  <div className="pl-2 text-slate-500 text-[11px] italic py-0.5">
                    No remote tracking branches
                  </div>
                ) : (
                  remoteForkGroups.map((fork) => {
                    const isForkOpen = openRemoteForks[fork.name] ?? (fork.name === "origin");
                    const isForkExpanded = !!showAllRemoteForks[fork.name];
                    const folderNames = Object.keys(fork.folders).sort();

                    // Count total branches and prepare visible branches up to 10 if not expanded
                    const maxBranches = isForkExpanded ? Infinity : 10;
                    const visibleSet = new Set(fork.branches.slice(0, maxBranches).map((b) => b.branch.name));
                    const visibleRootBranches = fork.rootBranches.filter((b) => visibleSet.has(b.branch.name));

                    return (
                      <div key={fork.name} className="space-y-0.5">
                        {/* Remote Fork Dropdown Header */}
                        <div className="flex items-center justify-between w-full px-1.5 py-1 text-slate-300 hover:text-slate-100 font-medium group select-none rounded hover:bg-shark-850/60 transition-colors">
                          <button
                            onClick={() =>
                              setOpenRemoteForks((prev) => ({
                                ...prev,
                                [fork.name]: !isForkOpen,
                              }))
                            }
                            className="flex items-center gap-1.5 flex-1 text-left min-w-0"
                          >
                            {isForkOpen ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            )}
                            <Globe className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                            <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                              {fork.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                              ({fork.branches.length})
                            </span>
                          </button>
                        </div>

                        {/* Remote Fork Children */}
                        {isForkOpen && (
                          <div className="pl-3 space-y-0.5">
                            {/* Root Branches (no folder) */}
                            {visibleRootBranches.map((entry) =>
                              renderRemoteBranchRow(entry.branch, entry.leafName)
                            )}

                            {/* Folder Dropdowns */}
                            {folderNames.map((folderName) => {
                              const folderBranches = fork.folders[folderName];
                              const visibleFolderBranches = folderBranches.filter((b) =>
                                visibleSet.has(b.branch.name)
                              );
                              if (visibleFolderBranches.length === 0) return null;

                              const folderKey = `${fork.name}:${folderName}`;
                              const isFolderOpen = openRemoteFolders[folderKey] ?? true;

                              return (
                                <div key={folderName} className="space-y-0.5">
                                  {/* Sub-folder Header */}
                                  <div
                                    onClick={() =>
                                      setOpenRemoteFolders((prev) => ({
                                        ...prev,
                                        [folderKey]: !isFolderOpen,
                                      }))
                                    }
                                    className="flex items-center justify-between px-1.5 py-0.5 text-slate-400 hover:text-slate-200 hover:bg-shark-850/40 rounded cursor-pointer select-none transition-colors"
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      {isFolderOpen ? (
                                        <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                      ) : (
                                        <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                      )}
                                      {isFolderOpen ? (
                                        <FolderOpen className="w-3 h-3 text-amber-400/80 flex-shrink-0" />
                                      ) : (
                                        <Folder className="w-3 h-3 text-amber-400/80 flex-shrink-0" />
                                      )}
                                      <span className="font-mono text-[11.5px] text-slate-300 font-medium truncate">
                                        {folderName}
                                      </span>
                                      <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                                        ({folderBranches.length})
                                      </span>
                                    </div>
                                  </div>

                                  {/* Folder Branches */}
                                  {isFolderOpen && (
                                    <div className="pl-2 space-y-0.5">
                                      {visibleFolderBranches.map((entry) =>
                                        renderRemoteBranchRow(entry.branch, entry.leafName, true)
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* View All / Show Less for Fork */}
                            {fork.branches.length > 10 && (
                              <button
                                onClick={() =>
                                  setShowAllRemoteForks((prev) => ({
                                    ...prev,
                                    [fork.name]: !isForkExpanded,
                                  }))
                                }
                                className="w-full flex items-center justify-center gap-1.5 py-1 px-2 mt-1 rounded text-[11px] font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 border border-dashed border-indigo-900/60 hover:border-indigo-700/60 transition-all select-none"
                              >
                                {isForkExpanded ? (
                                  <>
                                    <ChevronUp className="w-3 h-3" />
                                    <span>Show Less</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3 h-3" />
                                    <span>View All ({fork.branches.length})</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Section: Worktrees */}
          <WorktreeSection
            tab={tab}
            isOpen={sectionsOpen.worktrees}
            onToggle={() => toggleSection("worktrees")}
          />


          {/* Section: Stashes */}
          <StashSection
            tab={tab}
            isOpen={sectionsOpen.stashes}
            onToggle={() => toggleSection("stashes")}
          />

          {/* Section: Tags */}
          <TagSection
            tab={tab}
            isOpen={sectionsOpen.tags}
            onToggle={() => toggleSection("tags")}
          />

          {/* Section: Client Hooks */}
          {tab.hooksInfo && tab.hooksInfo.active_hooks.length > 0 && (
            <div>
              <button
                onClick={() => toggleSection("hooks")}
                className="flex items-center justify-between w-full px-1.5 py-1 text-slate-300 hover:text-slate-100 font-medium"
              >
                <div className="flex items-center gap-1.5">
                  {sectionsOpen.hooks ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Git Hooks</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {tab.hooksInfo.active_hooks.length}
                </span>
              </button>
              {sectionsOpen.hooks && (
                <div className="mt-1 space-y-1 pl-3">
                  {tab.hooksInfo.active_hooks.map((h) => (
                    <div
                      key={h.name}
                      className="group flex items-center justify-between px-2 py-1 rounded text-[11px] bg-shark-850/80 border border-shark-750/60 hover:border-shark-700 transition-colors"
                      title={h.path}
                    >
                      <div className="flex items-center gap-1.5 truncate mr-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        <span className="font-mono text-slate-200 truncate">{h.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => executeHookDryRun(tab.id, h.name)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-sky-950/80 hover:bg-sky-900 border border-sky-800/60 hover:border-sky-700 text-sky-300 font-mono transition-colors shadow-sm"
                          title={`Dry-run '${h.name}' hook directly in terminal`}
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>Dry Run</span>
                        </button>
                        <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 font-mono">
                          active
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer Section: Remote Repository Links (Browser & New PR) */}
      {!tab.sidebarCollapsed && (
        <div className="px-2.5 py-1.5 border-t border-shark-800/80 bg-shark-950/50 flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => openRepoInBrowser(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 h-7 px-2 rounded text-xs border border-shark-800 text-slate-300 hover:text-sky-300 hover:border-sky-800/60 hover:bg-shark-850 transition-colors shadow-sm"
            title="Open Repository in Browser (Ctrl+Shift+B / Cmd+Shift+B)"
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[11px] font-medium">Browser</span>
          </button>

          <button
            onClick={() => {
              if (activeBranchPr) {
                openInBrowserIpc(activeBranchPr.url);
              } else {
                createPullRequestInBrowser(tab.id);
              }
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 h-7 px-2 rounded text-xs border transition-colors shadow-sm ${
              activeBranchPr
                ? "border-emerald-700/60 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60 hover:border-emerald-600"
                : "border-shark-800 text-slate-300 hover:text-emerald-300 hover:border-emerald-800/60 hover:bg-shark-850"
            }`}
            title={
              activeBranchPr
                ? `Pull Request #${activeBranchPr.number}: ${activeBranchPr.title}${activeBranchPr.is_draft ? " (Draft)" : ""} — Click to open in browser`
                : "Create Pull Request in Browser (Ctrl+Shift+P / Cmd+Shift+P)"
            }
          >
            <GitPullRequest className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-medium truncate">
              {activeBranchPr ? `PR #${activeBranchPr.number}` : "New PR"}
            </span>
          </button>
        </div>
      )}

      {/* Sidebar Footer: Version info & Settings */}
      <div className="px-3 py-2 border-t border-shark-800/80 bg-shark-950/60 flex items-center justify-between text-xs select-none flex-shrink-0">
        {!tab.sidebarCollapsed ? (
          <>
            <div className="flex items-center gap-1.5 truncate mr-1">
              <span className="text-[11px] font-semibold text-slate-400">GitShark</span>
              <span className="font-mono text-[10px] text-sky-400/90 bg-sky-950/60 border border-sky-800/40 px-1.5 py-0.2 rounded font-medium">
                v{APP_VERSION}
              </span>
              {hasUpdate && latestVersion && (
                <button
                  onClick={() => openInBrowserIpc(releaseUrl)}
                  className="flex items-center gap-1 font-mono text-[9px] text-emerald-300 bg-emerald-950/90 border border-emerald-500/50 hover:bg-emerald-900/80 px-1.5 py-0.5 rounded font-semibold transition-all shadow-[0_0_8px_rgba(16,185,129,0.25)] animate-pulse"
                  title={`Update available: v${latestVersion}! Click to open release notes & download.`}
                >
                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Update: v{latestVersion}</span>
                </button>
              )}
            </div>
            <button
              onClick={() => openSettings("git")}
              className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-shark-800 transition-colors"
              title="Settings & Git Executable"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={() => openSettings("about")}
            className="relative w-full flex items-center justify-center p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-shark-800 transition-colors"
            title={`GitShark v${APP_VERSION}${hasUpdate && latestVersion ? ` (Update v${latestVersion} available)` : ""} — Settings`}
          >
            <Settings className="w-3.5 h-3.5" />
            {hasUpdate && (
              <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-shark-950 animate-pulse" />
            )}
          </button>
        )}
      </div>

      {/* Floating Branch Context Menu */}
      {contextMenu && (
        <BranchContextMenu
          branch={contextMenu.branch}
          currentBranch={currentBranch}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onCheckout={handleCheckoutBranch}
          onPull={handlePullBranch}
          onPush={handlePushBranch}
          onFetch={handleFetch}
          onMerge={handleMergeBranch}
          onCreateBranchFrom={(b) => {
            setCreateBranchBase(b);
            setIsAddingBranch(true);
            setSectionsOpen((prev) => ({ ...prev, branches: true }));
          }}
          onRename={(b) => setBranchToRename(b)}
          onDelete={(b) => promptDeleteBranch(b.shorthand, b.is_remote)}
          onComparePr={(b) => openInPrView(tab.id, b.shorthand)}
          activePr={contextMenu.activePr}
          onOpenPr={(b) => {
            if (contextMenu.activePr) {
              openInBrowserIpc(contextMenu.activePr.url);
            } else {
              createPullRequestInBrowser(tab.id, b.shorthand);
            }
          }}
          linkedWorktree={contextMenu.linkedWorktree}
          onPruneWorktrees={() => pruneWorktrees(tab.id)}
          onOpenWorktreeTab={(path) => openRepositoryTab(path)}
        />
      )}

      {/* Modal for Renaming Local Branches */}
      {branchToRename && (
        <RenameBranchModal
          isOpen={true}
          currentName={branchToRename.shorthand}
          existingBranches={localBranches.map((b) => b.shorthand)}
          isRenaming={isRenamingBranch}
          onConfirm={async (newName) => {
            setIsRenamingBranch(true);
            try {
              const success = await renameBranch(tab.id, branchToRename.shorthand, newName);
              if (success) {
                setBranchToRename(null);
              }
            } finally {
              setIsRenamingBranch(false);
            }
          }}
          onCancel={() => {
            if (!isRenamingBranch) {
              setBranchToRename(null);
            }
          }}
        />
      )}

      {/* Custom Confirmation Modal for Deleting Branches */}
      {branchToDelete && (
        <DeleteBranchModal
          isOpen={true}
          branchName={branchToDelete.branchName}
          isRemote={branchToDelete.isRemote}
          isDeleting={isDeletingBranch}
          worktrees={tab.worktrees}
          onConfirm={confirmDeleteBranch}
          onCancel={() => {
            if (!isDeletingBranch) {
              setBranchToDelete(null);
            }
          }}
        />
      )}
    </aside>
  );
};
