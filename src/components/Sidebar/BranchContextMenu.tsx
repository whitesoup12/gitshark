import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import type { BranchItem } from "@/types";
import {
  GitBranch,
  GitMerge,
  GitFork,
  ArrowDownToLine,
  ArrowUpToLine,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  Globe,
  GitPullRequest,
  Layers,
  AlertTriangle,
  Edit3,
} from "lucide-react";

export interface BranchContextMenuProps {
  branch: BranchItem;
  currentBranch: string;
  position: { x: number; y: number };
  onClose: () => void;
  onCheckout: (branch: BranchItem) => void;
  onPull: (branch: BranchItem) => void;
  onPush: (branch: BranchItem) => void;
  onFetch: () => void;
  onMerge: (branch: BranchItem) => void;
  onCreateBranchFrom: (branch: BranchItem) => void;
  onRename?: (branch: BranchItem) => void;
  onDelete: (branch: BranchItem) => void;
  onOpenPr?: (branch: BranchItem) => void;
  activePr?: import("@/types").PullRequestInfo | null;
  linkedWorktree?: import("@/types").WorktreeItem | null;
  onPruneWorktrees?: () => void;
  onOpenWorktreeTab?: (path: string) => void;
}

export const BranchContextMenu: React.FC<BranchContextMenuProps> = ({
  branch,
  currentBranch,
  position,
  onClose,
  onCheckout,
  onPull,
  onPush,
  onFetch,
  onMerge,
  onCreateBranchFrom,
  onRename,
  onDelete,
  onOpenPr,
  activePr,
  linkedWorktree,
  onPruneWorktrees,
  onOpenWorktreeTab,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState(position);
  const [copied, setCopied] = useState(false);

  const isCurrent = branch.is_head || branch.shorthand === currentBranch;

  // Viewport bounds detection and automatic clamping
  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const padding = 12;
      let x = position.x;
      let y = position.y;

      if (x + rect.width > window.innerWidth - padding) {
        x = Math.max(padding, window.innerWidth - rect.width - padding);
      }
      if (y + rect.height > window.innerHeight - padding) {
        y = Math.max(padding, window.innerHeight - rect.height - padding);
      }
      setAdjustedPos({ x, y });
    }
  }, [position]);

  // Close context menu on outside click, window blur, Escape key, or scroll
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleScroll = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  const handleCopyName = async () => {
    try {
      await navigator.clipboard.writeText(branch.shorthand);
      setCopied(true);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      console.warn("Failed to copy branch name to clipboard", err);
    }
  };

  return (
    <div
      ref={menuRef}
      style={{ top: adjustedPos.y, left: adjustedPos.x }}
      className="fixed z-50 w-64 bg-shark-900/95 border border-shark-750/90 rounded-lg shadow-2xl py-1 text-xs text-slate-200 select-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header with branch info */}
      <div className="px-3 py-1.5 border-b border-shark-800 flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400 bg-shark-950/40 rounded-t-lg">
        <div className="flex items-center gap-1.5 truncate">
          {branch.is_remote ? (
            <Globe className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
          ) : (
            <GitBranch className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
          )}
          <span className="truncate font-semibold text-slate-200" title={branch.shorthand}>
            {branch.shorthand}
          </span>
        </div>
        {isCurrent && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/60 font-mono flex-shrink-0">
            HEAD
          </span>
        )}
      </div>

      <div className="py-1">
        {/* Checkout */}
        <button
          onClick={() => {
            if (!isCurrent) {
              onCheckout(branch);
              onClose();
            }
          }}
          disabled={isCurrent}
          className={`flex items-center justify-between w-full px-3 py-1.5 text-left transition-colors ${
            isCurrent
              ? "text-slate-500 cursor-not-allowed opacity-60"
              : "hover:bg-sky-600/20 hover:text-sky-300 text-slate-200 cursor-pointer"
          }`}
          title={isCurrent ? "Already current branch" : `Checkout '${branch.shorthand}'`}
        >
          <div className="flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5 text-sky-400" />
            <span>Checkout</span>
          </div>
          {isCurrent && <span className="text-[10px] text-slate-500 italic">current</span>}
        </button>

        {/* Linked Worktree / Prune Actions */}
        {linkedWorktree && (
          linkedWorktree.is_prunable ? (
            <button
              onClick={() => {
                if (onPruneWorktrees) {
                  onPruneWorktrees();
                }
                onClose();
              }}
              className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-rose-950/40 text-rose-300 cursor-pointer transition-colors text-left"
              title="Worktree directory missing on disk. Prune to unlock this branch for checkout."
            >
              <div className="flex items-center gap-2 truncate flex-1 mr-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                <span className="truncate">Prune Orphaned Worktree</span>
              </div>
              <span className="text-[10px] text-rose-400/80 font-mono flex-shrink-0">unlock</span>
            </button>
          ) : (
            <button
              onClick={() => {
                if (onOpenWorktreeTab) {
                  onOpenWorktreeTab(linkedWorktree.path);
                }
                onClose();
              }}
              className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-sky-600/20 hover:text-sky-300 text-sky-200 cursor-pointer transition-colors text-left"
              title={`Open worktree at '${linkedWorktree.path}' in a new tab`}
            >
              <div className="flex items-center gap-2 truncate flex-1 mr-1">
                <Layers className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span className="truncate">Open Worktree Tab</span>
              </div>
            </button>
          )
        )}

        {/* Pull */}
        <button
          onClick={() => {
            onPull(branch);
            onClose();
          }}
          className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-sky-600/20 hover:text-sky-300 text-slate-200 cursor-pointer transition-colors text-left"
          title={`Pull changes for '${branch.shorthand}'`}
        >
          <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
          <span>Pull</span>
        </button>

        {/* Push (Local branches only) */}
        {!branch.is_remote && (
          <button
            onClick={() => {
              onPush(branch);
              onClose();
            }}
            className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-sky-600/20 hover:text-sky-300 text-slate-200 cursor-pointer transition-colors text-left"
            title={`Push branch '${branch.shorthand}' to remote`}
          >
            <ArrowUpToLine className="w-3.5 h-3.5 text-amber-400" />
            <span>Push</span>
          </button>
        )}

        {/* Fetch */}
        <button
          onClick={() => {
            onFetch();
            onClose();
          }}
          className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-sky-600/20 hover:text-sky-300 text-slate-200 cursor-pointer transition-colors text-left"
          title="Fetch latest remote branches and commits (git fetch --prune)"
        >
          <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
          <span>Fetch All</span>
        </button>
      </div>

      <div className="h-[1px] bg-shark-800 my-1" />

      {/* Merge into active branch */}
      <div className="py-0.5">
        <button
          onClick={() => {
            if (!isCurrent) {
              onMerge(branch);
              onClose();
            }
          }}
          disabled={isCurrent}
          className={`flex items-center justify-between w-full px-3 py-1.5 text-left transition-colors ${
            isCurrent
              ? "text-slate-500 cursor-not-allowed opacity-60"
              : "hover:bg-purple-600/20 hover:text-purple-300 text-slate-200 cursor-pointer"
          }`}
          title={
            isCurrent
              ? "Cannot merge branch into itself"
              : `Merge '${branch.shorthand}' into active branch '${currentBranch}'`
          }
        >
          <div className="flex items-center gap-2 truncate flex-1 mr-1">
            <GitMerge className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
            <span className="truncate">Merge into '{currentBranch}'</span>
          </div>
          {isCurrent && <span className="text-[10px] text-slate-500 italic">self</span>}
        </button>
      </div>

      <div className="h-[1px] bg-shark-800 my-1" />

      <div className="py-0.5">
        {/* Create Branch From... */}
        <button
          onClick={() => {
            onCreateBranchFrom(branch);
            onClose();
          }}
          className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-sky-600/20 hover:text-sky-300 text-slate-200 cursor-pointer transition-colors text-left"
          title={`Create a new branch based on '${branch.shorthand}'`}
        >
          <GitFork className="w-3.5 h-3.5 text-sky-400" />
          <span>New Branch From Here...</span>
        </button>

        {/* View / Create Pull Request in Browser */}
        {activePr ? (
          <button
            onClick={() => {
              if (onOpenPr) {
                onOpenPr(branch);
              }
              onClose();
            }}
            className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-emerald-600/20 hover:text-emerald-300 text-emerald-300 cursor-pointer transition-colors text-left"
            title={`View Pull Request #${activePr.number}: ${activePr.title}${activePr.is_draft ? " (Draft)" : ""} in browser`}
          >
            <div className="flex items-center gap-2 truncate flex-1 mr-1">
              <GitPullRequest className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="truncate">View PR #{activePr.number} in Browser</span>
            </div>
            {activePr.is_draft && (
              <span className="text-[10px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded font-mono">draft</span>
            )}
          </button>
        ) : onOpenPr ? (
          <button
            onClick={() => {
              onOpenPr(branch);
              onClose();
            }}
            className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-emerald-600/20 hover:text-emerald-300 text-slate-200 cursor-pointer transition-colors text-left"
            title={`Create Pull Request for '${branch.shorthand}' in browser`}
          >
            <GitPullRequest className="w-3.5 h-3.5 text-emerald-400" />
            <span>Create Pull Request...</span>
          </button>
        ) : null}

        {/* Rename Branch (Local unpushed branches only) */}
        {!branch.is_remote && (
          <button
            onClick={() => {
              if (!branch.upstream && onRename) {
                onRename(branch);
                onClose();
              }
            }}
            disabled={Boolean(branch.upstream)}
            className={`flex items-center justify-between w-full px-3 py-1.5 text-left transition-colors ${
              branch.upstream
                ? "text-slate-500 cursor-not-allowed opacity-60"
                : "hover:bg-sky-600/20 hover:text-sky-300 text-slate-200 cursor-pointer"
            }`}
            title={
              branch.upstream
                ? `Cannot rename '${branch.shorthand}': already pushed to remote (${branch.upstream})`
                : `Rename local branch '${branch.shorthand}'`
            }
          >
            <div className="flex items-center gap-2">
              <Edit3 className="w-3.5 h-3.5 text-sky-400" />
              <span>Rename Branch...</span>
            </div>
            {branch.upstream && (
              <span className="text-[10px] text-slate-500 italic">pushed</span>
            )}
          </button>
        )}

        {/* Copy Branch Name */}
        <button
          onClick={handleCopyName}
          className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-shark-800 text-slate-200 cursor-pointer transition-colors text-left"
          title="Copy branch name to clipboard"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>{copied ? "Copied Branch Name!" : "Copy Branch Name"}</span>
        </button>
      </div>

      <div className="h-[1px] bg-shark-800 my-1" />

      {/* Delete Branch */}
      <div className="py-0.5">
        <button
          onClick={() => {
            if (!isCurrent) {
              onDelete(branch);
              onClose();
            }
          }}
          disabled={isCurrent}
          className={`flex items-center justify-between w-full px-3 py-1.5 text-left transition-colors ${
            isCurrent
              ? "text-slate-600 cursor-not-allowed opacity-50"
              : "hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 cursor-pointer"
          }`}
          title={
            isCurrent
              ? "Cannot delete the currently checked-out branch"
              : `Delete '${branch.shorthand}'`
          }
        >
          <div className="flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Delete Branch</span>
          </div>
          {isCurrent && <span className="text-[10px] text-slate-600 italic">active</span>}
        </button>
      </div>
    </div>
  );
};
