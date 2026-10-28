import React, { useState, useEffect } from "react";
import { Tab, WorktreeItem } from "@/types";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { showConfirm } from "@/store/useDialogStore";
import { pickRepositoryDirectory } from "@/lib/ipc";
import {
  Layers,
  ChevronDown,
  ChevronRight,
  Plus,
  ExternalLink,
  Trash2,
  Lock,
  GitBranch,
  FolderOpen,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface WorktreeSectionProps {
  tab: Tab;
  isOpen: boolean;
  onToggle: () => void;
}

interface ContextMenuState {
  worktree: WorktreeItem;
  x: number;
  y: number;
}

export const WorktreeSection: React.FC<WorktreeSectionProps> = ({
  tab,
  isOpen,
  onToggle,
}) => {
  const { openRepositoryTab, addWorktree, removeWorktree, pruneWorktrees, fetchWorktrees } =
    useWorkspaceStore();

  const [isPruning, setIsPruning] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [pathTouched, setPathTouched] = useState(false);
  const [createBranch, setCreateBranch] = useState(true);
  const [noTrack, setNoTrack] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);

  // Fetch worktrees on mount if needed
  useEffect(() => {
    if (tab.repoId && !tab.worktrees) {
      fetchWorktrees(tab.id);
    }
  }, [tab.id, tab.repoId, tab.worktrees, fetchWorktrees]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const worktrees = tab.worktrees ?? [];

  const handleBranchChange = (branchVal: string) => {
    setNewBranch(branchVal);
    if (!pathTouched) {
      const cleanBranch = branchVal.trim().replace(/[/\\:]+/g, "-");
      if (cleanBranch && tab.metadata?.path) {
        const repoPath = tab.metadata.path.replace(/[\/\\]+$/, "");
        const separator = repoPath.includes("\\") ? "\\" : "/";
        setNewPath(`${repoPath}-worktrees${separator}${cleanBranch}`);
      } else if (!cleanBranch) {
        setNewPath("");
      }
    }
  };

  const handleBrowsePath = async () => {
    const selected = await pickRepositoryDirectory();
    if (selected) {
      setPathTouched(true);
      const cleanSelected = selected.replace(/[\/\\]+$/, "");
      const separator = cleanSelected.includes("\\") ? "\\" : "/";
      const cleanBranch = newBranch.trim().replace(/[/\\:]+/g, "-");
      if (cleanBranch && !cleanSelected.endsWith(cleanBranch)) {
        setNewPath(`${cleanSelected}${separator}${cleanBranch}`);
      } else {
        setNewPath(cleanSelected);
      }
    }
  };

  const handleCreateWorktree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPath.trim() || !newBranch.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const success = await addWorktree(
        tab.id,
        newPath.trim(),
        newBranch.trim(),
        createBranch,
        noTrack
      );
      if (success) {
        setNewPath("");
        setNewBranch("");
        setPathTouched(false);
        setIsAdding(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveWorktree = async (w: WorktreeItem, force = false) => {
    if (w.is_main) return;
    const confirmed = await showConfirm({
      title: "Remove Worktree",
      message: `Are you sure you want to remove the worktree at:\n"${w.path}"?`,
      confirmText: "Remove Worktree",
      variant: "danger",
    });

    if (confirmed) {
      await removeWorktree(tab.id, w.path, force);
    }
  };

  const handleOpenInNewTab = (w: WorktreeItem) => {
    openRepositoryTab(w.path);
  };

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 1500);
  };

  const hasPrunable = worktrees.some((w) => w.is_prunable);

  const handlePrune = async () => {
    if (isPruning) return;
    setIsPruning(true);
    try {
      await pruneWorktrees(tab.id);
    } finally {
      setIsPruning(false);
    }
  };

  return (
    <div>
      {/* Worktrees Header Accordion */}
      <div className="flex items-center justify-between w-full px-1.5 py-1 text-slate-300 font-medium select-none">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 hover:text-slate-100 flex-1 text-left"
        >
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          <span>Worktrees</span>
          <span className="text-[10px] text-slate-500 font-mono">
            ({worktrees.length})
          </span>
        </button>

        <div className="flex items-center gap-1">
          {hasPrunable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrune();
              }}
              disabled={isPruning}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-950/70 border border-rose-800/60 text-rose-300 hover:bg-rose-900/70 transition-colors"
              title="Prune orphaned worktrees whose folders have been deleted on disk"
            >
              {isPruning ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
              )}
              <span>Prune</span>
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isOpen) onToggle();
              setIsAdding((prev) => !prev);
            }}
            className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-shark-800 transition-colors"
            title="Add Linked Worktree"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Worktree Items List */}
      {isOpen && (
        <div className="mt-1 space-y-1 pl-3 text-xs">
          {/* Add Worktree Form */}
          {isAdding && (
            <form
              onSubmit={handleCreateWorktree}
              className="p-2.5 bg-shark-950 border border-sky-600/40 rounded-lg space-y-2 mb-2 text-xs select-none shadow-md"
            >
              <div className="text-[11px] font-bold text-sky-300 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                <span>New Worktree</span>
              </div>

              {/* Path Input */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Path</label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newPath}
                    onChange={(e) => {
                      setNewPath(e.target.value);
                      setPathTouched(true);
                    }}
                    placeholder="Worktree folder path"
                    className="flex-1 px-2 py-1 bg-shark-900 border border-shark-750 focus:border-sky-500 rounded text-[11px] font-mono text-slate-200 outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleBrowsePath}
                    className="p-1 bg-shark-800 hover:bg-shark-750 rounded text-slate-300"
                    title="Browse Directory"
                  >
                    <FolderOpen className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Branch Input */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Branch</label>
                <input
                  type="text"
                  value={newBranch}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  placeholder="e.g. feature/my-worktree"
                  className="w-full px-2 py-1 bg-shark-900 border border-shark-750 focus:border-sky-500 rounded text-[11px] font-mono text-slate-200 outline-none"
                  required
                />
              </div>

              {/* Create new branch toggle & No-track */}
              <div className="space-y-1.5 pt-0.5">
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createBranch}
                    onChange={(e) => setCreateBranch(e.target.checked)}
                    className="rounded bg-shark-900 border-shark-700 text-sky-500"
                  />
                  <span>Create new branch (-b)</span>
                </label>

                {createBranch && (
                  <label
                    className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer pl-4"
                    title="Do not set up tracking for the new branch. Prevents accidentally pushing changes back into the base/parent branch."
                  >
                    <input
                      type="checkbox"
                      checked={noTrack}
                      onChange={(e) => setNoTrack(e.target.checked)}
                      className="rounded bg-shark-900 border-shark-700 text-sky-500"
                    />
                    <span>No tracking (--no-track, recommended)</span>
                  </label>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setNewPath("");
                    setNewBranch("");
                    setPathTouched(false);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-slate-200 hover:bg-shark-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPath.trim() || !newBranch.trim() || isSubmitting}
                  className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-medium text-[10px]"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <span>Add</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {worktrees.length === 0 ? (
            <div className="py-1 pl-1">
              <div className="text-slate-500 text-[11px] italic mb-1.5">No linked worktrees</div>
              {!isAdding && (
                <button
                  type="button"
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-shark-850 hover:bg-shark-800 text-sky-400 hover:text-sky-300 border border-shark-750 text-[10px] font-medium transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Worktree</span>
                </button>
              )}
            </div>
          ) : (
            worktrees.map((w) => {
              const dirName = w.path.split(/[/\\]/).pop() || w.path;
              const branchName = w.branch ?? (w.is_detached ? "Detached" : "HEAD");

              return (
                <div
                  key={w.path}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      worktree: w,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  className="group flex items-center justify-between px-2 py-1.5 rounded hover:bg-shark-850/80 border border-transparent hover:border-shark-750 transition-colors select-none text-[11px]"
                >
                  {/* Left: Info */}
                  <div className="truncate flex-1 mr-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <GitBranch className="w-3 h-3 text-sky-400 flex-shrink-0" />
                      <span className="font-semibold text-slate-200 truncate">
                        {branchName}
                      </span>

                      {w.is_main && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-sky-950/80 border border-sky-800/80 text-sky-300 font-mono">
                          main
                        </span>
                      )}

                      {w.is_prunable && (
                        <span
                          className="flex items-center gap-0.5 text-[9px] px-1 py-0.2 rounded bg-rose-950/80 border border-rose-800/80 text-rose-300 font-mono"
                          title="Worktree directory missing on disk (orphaned). Pruning will free up this branch."
                        >
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                          orphaned
                        </span>
                      )}

                      {w.is_locked && (
                        <span
                          className="text-[9px] text-amber-400"
                          title={w.lock_reason ?? "Locked worktree"}
                        >
                          <Lock className="w-2.5 h-2.5 inline" />
                        </span>
                      )}
                    </div>

                    <div
                      className={`text-[10px] font-mono truncate pl-4.5 ${
                        w.is_prunable ? "text-rose-400/80 line-through" : "text-slate-500"
                      }`}
                      title={w.is_prunable ? `${w.path} (missing on disk)` : w.path}
                    >
                      {dirName} {w.is_prunable && <span className="no-underline text-rose-300 ml-1">(missing)</span>}
                    </div>
                  </div>

                  {/* Right Actions on Hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {w.is_prunable ? (
                      <button
                        onClick={handlePrune}
                        disabled={isPruning}
                        className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 transition-colors"
                        title="Prune orphaned worktree (git worktree prune)"
                      >
                        {isPruning ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleOpenInNewTab(w)}
                          className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-shark-800 transition-colors"
                          title="Open Worktree in New Tab"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>

                        {!w.is_main && (
                          <button
                            onClick={() => handleRemoveWorktree(w)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-shark-800 transition-colors"
                            title="Remove Worktree"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Floating Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-52 bg-shark-900 border border-shark-750 rounded-lg shadow-xl py-1 text-xs text-slate-200 select-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.worktree.is_prunable ? (
            <button
              onClick={() => {
                handlePrune();
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-rose-950/40 text-rose-300 transition-colors text-left"
              title="Prune missing worktree and unlock branch"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Prune Orphaned Worktree</span>
            </button>
          ) : (
            <button
              onClick={() => {
                handleOpenInNewTab(contextMenu.worktree);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-sky-600/20 hover:text-sky-300 transition-colors text-left"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              <span>Open in New Tab</span>
            </button>
          )}

          <button
            onClick={() => {
              handleCopyPath(contextMenu.worktree.path);
              setContextMenu(null);
            }}
            className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-shark-800 transition-colors text-left"
          >
            {copiedPath ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>Copy Worktree Path</span>
          </button>

          {!contextMenu.worktree.is_main && !contextMenu.worktree.is_prunable && (
            <>
              <div className="h-[1px] bg-shark-800 my-1" />
              <button
                onClick={() => {
                  handleRemoveWorktree(contextMenu.worktree);
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-rose-950/40 text-rose-300 transition-colors text-left"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Remove Worktree</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
