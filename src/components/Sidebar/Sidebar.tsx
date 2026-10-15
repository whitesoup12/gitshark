import React, { useState } from "react";
import { Tab } from "@/types";
import {
  GitBranch,
  FolderGit2,
  Bookmark,
  Archive,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  FolderTree,
  ShieldCheck,
  Globe,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Loader2,
  Check,
  Cloud,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { WorktreeSection } from "./WorktreeSection";
import { StashSection } from "./StashSection";
import { TagSection } from "./TagSection";
import { APP_VERSION } from "@/constants/version";


interface SidebarProps {
  tab: Tab;
}

export const Sidebar: React.FC<SidebarProps> = ({ tab }) => {
  const {
    refreshTabMetadata,
    checkoutBranch,
    createBranch,
    deleteBranch,
    executePull,
    executePush,
    executeFetch,
    fetchRemoteSyncStatus,
    fetchBranches,
  } = useWorkspaceStore();

  const [sectionsOpen, setSectionsOpen] = useState({
    branches: true,
    remotes: true,
    stashes: true,
    worktrees: true,
    tags: false,
    hooks: true,
  });

  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [checkoutNewBranch, setCheckoutNewBranch] = useState(true);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [isFetchingRemote, setIsFetchingRemote] = useState(false);

  const toggleSection = (key: keyof typeof sectionsOpen) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim() || isCreatingBranch) return;

    setIsCreatingBranch(true);
    try {
      const success = await createBranch(
        tab.id,
        newBranchName.trim(),
        undefined,
        checkoutNewBranch
      );
      if (success) {
        setNewBranchName("");
        setIsAddingBranch(false);
      }
    } finally {
      setIsCreatingBranch(false);
    }
  };

  const handleDeleteBranch = async (branchName: string, isRemote = false) => {
    const promptMsg = isRemote
      ? `Are you sure you want to delete remote tracking branch "${branchName}"?`
      : `Are you sure you want to delete branch "${branchName}"?`;
    if (window.confirm(promptMsg)) {
      await deleteBranch(tab.id, branchName, isRemote);
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

  return (
    <aside
      className={`flex flex-col bg-shark-900 border-r border-shark-800 transition-all duration-200 select-none ${
        tab.sidebarCollapsed ? "w-12" : "w-64"
      } h-full`}
    >
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
          <button
            onClick={() => refreshTabMetadata(tab.id)}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-shark-800 transition-colors"
            title="Refresh Repository State"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
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
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 text-xs">
          {/* Active / Current Branch Callout */}
          <div className="p-2.5 rounded-md bg-shark-850/80 border border-shark-750/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Active Branch
              </span>
              {/* Working Tree Clean/Dirty Badge */}
              {metadata?.is_dirty ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>
                    Dirty ({(metadata?.staged_count ?? 0) + (metadata?.unstaged_count ?? 0) + (metadata?.untracked_count ?? 0)})
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30">
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Clean</span>
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-medium text-sky-300 truncate">
                <GitBranch className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{currentBranch}</span>
              </div>

              {/* Upstream Tracking Status */}
              {tab.remoteSync && (
                <div className="flex items-center gap-1 text-[10px] flex-shrink-0">
                  {!tab.remoteSync.has_upstream ? (
                    <span className="text-slate-500 text-[10px]">No upstream</span>
                  ) : tab.remoteSync.ahead > 0 || tab.remoteSync.behind > 0 ? (
                    <div className="flex items-center gap-1 font-mono">
                      {tab.remoteSync.ahead > 0 && (
                        <span
                          className="text-emerald-400 flex items-center gap-0.5"
                          title={`${tab.remoteSync.ahead} commit(s) ahead of remote`}
                        >
                          <ArrowUp className="w-3 h-3" />
                          {tab.remoteSync.ahead}
                        </span>
                      )}
                      {tab.remoteSync.behind > 0 && (
                        <span
                          className="text-amber-400 flex items-center gap-0.5"
                          title={`${tab.remoteSync.behind} commit(s) behind remote`}
                        >
                          <ArrowDown className="w-3 h-3" />
                          {tab.remoteSync.behind}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span
                      className="text-sky-400/80 flex items-center gap-1 font-mono text-[10px]"
                      title="Up to date with remote"
                    >
                      <Cloud className="w-3 h-3 text-sky-400" />
                      <span>synced</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

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
                  setIsAddingBranch((prev) => !prev);
                }}
                className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-shark-800 transition-colors"
                title="Create New Branch"
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
                    <div className="text-[11px] font-bold text-sky-300 flex items-center gap-1">
                      <GitBranch className="w-3 h-3" />
                      <span>New Branch</span>
                    </div>

                    <input
                      type="text"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="Branch name (e.g. feature/my-branch)"
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
                        onClick={() => setIsAddingBranch(false)}
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

                {localBranches.map((branch) => {
                  const isCurrent = branch.is_head || branch.shorthand === currentBranch;
                  return (
                    <div
                      key={branch.name}
                      onClick={() => {
                        if (!isCurrent) {
                          checkoutBranch(tab.id, branch.shorthand);
                        }
                      }}
                      className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                        isCurrent
                          ? "bg-sky-950/40 text-sky-300 border border-sky-800/40 font-medium"
                          : "text-slate-400 hover:text-slate-200 hover:bg-shark-800/60"
                      }`}
                      title={isCurrent ? "Current branch" : `Click to checkout '${branch.shorthand}'`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 mr-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            isCurrent ? "bg-sky-400" : "bg-slate-600 group-hover:bg-slate-400"
                          }`}
                        />
                        <span className="truncate">{branch.shorthand}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isCurrent ? (
                          <span className="text-[10px] text-sky-400/80 font-mono">HEAD</span>
                        ) : (
                          <>
                            <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 hover:text-sky-300 transition-opacity">
                              checkout
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBranch(branch.shorthand);
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
                  );
                })}
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
              <div className="mt-1 space-y-0.5 pl-2">
                {remoteBranches.length === 0 ? (
                  <div className="pl-2 text-slate-500 text-[11px] italic py-0.5">
                    No remote tracking branches
                  </div>
                ) : (
                  remoteBranches.map((branch) => (
                    <div
                      key={branch.name}
                      onClick={() => checkoutBranch(tab.id, branch.shorthand)}
                      className="group flex items-center justify-between px-2 py-1 rounded text-slate-400 hover:text-slate-200 hover:bg-shark-800/60 cursor-pointer transition-colors"
                      title={`Click to checkout local branch from '${branch.shorthand}'`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Globe className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                        <span className="truncate">{branch.shorthand}</span>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBranch(branch.shorthand, true);
                          }}
                          className="p-0.5 rounded text-slate-400 hover:text-rose-400 hover:bg-shark-750 transition-colors"
                          title={`Delete remote branch '${branch.shorthand}'`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <span className="text-[10px] text-slate-500 hover:text-indigo-300">
                          checkout
                        </span>
                      </div>
                    </div>
                  ))
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
                      className="flex items-center justify-between px-2 py-1 rounded text-[11px] bg-shark-850/80 border border-shark-750/60"
                      title={h.path}
                    >
                      <span className="font-mono text-slate-200">{h.name}</span>
                      <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 font-mono">
                        active
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sidebar Footer: Version info */}
      <div className="px-3 py-2 border-t border-shark-800/80 bg-shark-950/60 flex items-center justify-between text-xs select-none flex-shrink-0">
        {!tab.sidebarCollapsed ? (
          <>
            <span className="text-[11px] font-semibold text-slate-400">GitShark</span>
            <span className="font-mono text-[10px] text-sky-400/90 bg-sky-950/60 border border-sky-800/40 px-1.5 py-0.2 rounded font-medium">
              v{APP_VERSION}
            </span>
          </>
        ) : (
          <span className="w-full text-center font-mono text-[9px] text-sky-400" title={`GitShark v${APP_VERSION}`}>
            v1.0
          </span>
        )}
      </div>
    </aside>
  );
};
