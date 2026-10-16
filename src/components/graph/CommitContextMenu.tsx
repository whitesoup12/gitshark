import React, { useEffect, useRef, useState } from "react";
import { CommitNode } from "@/types";
import { formatShortHash } from "@/lib/utils";
import {
  GitCommit,
  GitBranch,
  Bookmark,
  RotateCcw,
  Copy,
  Check,
  Compass,
  Sparkles,
  AlertTriangle,
  Undo2,
} from "lucide-react";

interface CommitContextMenuProps {
  commit: CommitNode;
  currentBranch: string;
  position: { x: number; y: number };
  onClose: () => void;
  onCherryPick: (commit: CommitNode) => void;
  onRevert: (commit: CommitNode) => void;
  onCheckoutCommit: (commit: CommitNode) => void;
  onCreateBranchFromCommit: (
    commit: CommitNode,
    branchName: string,
    checkout: boolean
  ) => Promise<void>;
  onCreateTagFromCommit: (
    commit: CommitNode,
    tagName: string,
    message?: string
  ) => Promise<void>;
  onResetToCommit: (
    commit: CommitNode,
    mode: "soft" | "mixed" | "hard"
  ) => Promise<void>;
}

export const CommitContextMenu: React.FC<CommitContextMenuProps> = ({
  commit,
  currentBranch,
  position,
  onClose,
  onCherryPick,
  onRevert,
  onCheckoutCommit,
  onCreateBranchFromCommit,
  onCreateTagFromCommit,
  onResetToCommit,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [copiedSha, setCopiedSha] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  // Sub-views inside the context menu so user doesn't lose context
  const [subView, setSubView] = useState<
    "menu" | "branch" | "tag" | "confirm-hard-reset"
  >("menu");

  const [branchName, setBranchName] = useState("");
  const [checkoutNewBranch, setCheckoutNewBranch] = useState(true);
  const [tagName, setTagName] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const clampedX = Math.min(position.x, window.innerWidth - 280);
  const clampedY = Math.min(position.y, window.innerHeight - 380);

  const handleBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCreateBranchFromCommit(
        commit,
        branchName.trim(),
        checkoutNewBranch
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCreateTagFromCommit(
        commit,
        tagName.trim(),
        tagMessage.trim() || undefined
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHardResetConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onResetToCommit(commit, "hard");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={menuRef}
      style={{ top: clampedY, left: clampedX }}
      className="fixed z-50 w-64 rounded-lg bg-shark-900/95 border border-shark-750 shadow-2xl shadow-black/80 text-xs text-slate-200 select-none backdrop-blur-md overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Commit Header Banner */}
      <div className="px-3 py-2 bg-shark-950/80 border-b border-shark-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 truncate">
          <GitCommit className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
          <span className="font-mono text-[11px] font-semibold text-sky-300">
            {formatShortHash(commit.hash)}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
          {commit.summary}
        </span>
      </div>

      {/* SUBVIEW: Create Branch Form */}
      {subView === "branch" && (
        <form onSubmit={handleBranchSubmit} className="p-3 space-y-2.5">
          <div className="text-[11px] font-semibold text-sky-300 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5" />
            <span>Create Branch at {formatShortHash(commit.hash)}</span>
          </div>
          <input
            type="text"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            placeholder="feature/from-commit"
            className="w-full px-2.5 py-1.5 rounded bg-shark-950 border border-shark-750 focus:border-sky-500 text-xs font-mono text-slate-100 outline-none"
            autoFocus
            required
          />
          <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={checkoutNewBranch}
              onChange={(e) => setCheckoutNewBranch(e.target.checked)}
              className="rounded bg-shark-950 border-shark-700 text-sky-500"
            />
            <span>Switch to new branch immediately</span>
          </label>
          <div className="flex items-center justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setSubView("menu")}
              className="px-2 py-1 rounded text-[11px] text-slate-400 hover:text-slate-200 hover:bg-shark-800"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!branchName.trim() || isSubmitting}
              className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-medium text-[11px]"
            >
              Create Branch
            </button>
          </div>
        </form>
      )}

      {/* SUBVIEW: Create Tag Form */}
      {subView === "tag" && (
        <form onSubmit={handleTagSubmit} className="p-3 space-y-2.5">
          <div className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5" />
            <span>Create Tag at {formatShortHash(commit.hash)}</span>
          </div>
          <input
            type="text"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            placeholder="v1.0.0"
            className="w-full px-2.5 py-1.5 rounded bg-shark-950 border border-shark-750 focus:border-amber-500 text-xs font-mono text-slate-100 outline-none"
            autoFocus
            required
          />
          <input
            type="text"
            value={tagMessage}
            onChange={(e) => setTagMessage(e.target.value)}
            placeholder="Annotation message (optional)"
            className="w-full px-2.5 py-1.5 rounded bg-shark-950 border border-shark-750 focus:border-amber-500 text-xs text-slate-200 outline-none"
          />
          <div className="flex items-center justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setSubView("menu")}
              className="px-2 py-1 rounded text-[11px] text-slate-400 hover:text-slate-200 hover:bg-shark-800"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!tagName.trim() || isSubmitting}
              className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-medium text-[11px]"
            >
              Create Tag
            </button>
          </div>
        </form>
      )}

      {/* SUBVIEW: Confirm Hard Reset */}
      {subView === "confirm-hard-reset" && (
        <div className="p-3 space-y-2.5">
          <div className="flex items-center gap-1.5 text-rose-400 font-semibold text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Confirm Hard Reset</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Reset <strong className="text-sky-300 font-mono">{currentBranch}</strong> to{" "}
            <strong className="text-amber-300 font-mono">
              {formatShortHash(commit.hash)}
            </strong>
            ? All uncommitted working tree changes and staged index modifications will be{" "}
            <strong className="text-rose-300">permanently chomped</strong>.
          </p>
          <div className="flex items-center justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setSubView("menu")}
              className="px-2 py-1 rounded text-[11px] text-slate-400 hover:text-slate-200 hover:bg-shark-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleHardResetConfirm}
              disabled={isSubmitting}
              className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-semibold text-[11px]"
            >
              Hard Reset 🦈
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTEXT MENU */}
      {subView === "menu" && (
        <div className="py-1">
          {/* Cherry-Pick & Revert */}
          <button
            onClick={() => {
              onCherryPick(commit);
              onClose();
            }}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-sky-600/20 hover:text-sky-300 text-left transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cherry-Pick Commit</span>
          </button>

          <button
            onClick={() => {
              onRevert(commit);
              onClose();
            }}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-sky-600/20 hover:text-sky-300 text-left transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Revert Commit</span>
          </button>

          <div className="my-1 border-t border-shark-800" />

          {/* Branch, Tag, & Checkout */}
          <button
            onClick={() => setSubView("branch")}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-sky-600/20 hover:text-sky-300 text-left transition-colors"
          >
            <GitBranch className="w-3.5 h-3.5 text-sky-400" />
            <span>Create Branch Here...</span>
          </button>

          <button
            onClick={() => setSubView("tag")}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-sky-600/20 hover:text-sky-300 text-left transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span>Create Tag Here...</span>
          </button>

          <button
            onClick={() => {
              onCheckoutCommit(commit);
              onClose();
            }}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-sky-600/20 hover:text-sky-300 text-left transition-colors"
          >
            <Compass className="w-3.5 h-3.5 text-indigo-400" />
            <span>Checkout Commit (Detached)</span>
          </button>

          <div className="my-1 border-t border-shark-800" />

          {/* Reset options */}
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Reset '{currentBranch}' to Here
          </div>

          <button
            onClick={async () => {
              await onResetToCommit(commit, "soft");
              onClose();
            }}
            className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-sky-600/20 hover:text-sky-300 text-left transition-colors"
          >
            <span className="flex items-center gap-2">
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Soft Reset</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">keep staged</span>
          </button>

          <button
            onClick={async () => {
              await onResetToCommit(commit, "mixed");
              onClose();
            }}
            className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-sky-600/20 hover:text-sky-300 text-left transition-colors"
          >
            <span className="flex items-center gap-2">
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Mixed Reset</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">keep unstaged</span>
          </button>

          <button
            onClick={() => setSubView("confirm-hard-reset")}
            className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-rose-950/50 text-rose-300 text-left transition-colors"
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Hard Reset...</span>
            </span>
            <span className="text-[10px] font-mono text-rose-400/80">discard all</span>
          </button>

          <div className="my-1 border-t border-shark-800" />

          {/* Clipboard utilities */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(commit.hash);
              setCopiedSha(true);
              setTimeout(() => {
                setCopiedSha(false);
                onClose();
              }, 500);
            }}
            className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-shark-800 text-slate-300 text-left transition-colors"
          >
            <span className="flex items-center gap-2">
              {copiedSha ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>Copy Commit SHA</span>
            </span>
            <span className="font-mono text-[10px] text-slate-500">
              {formatShortHash(commit.hash)}
            </span>
          </button>

          <button
            onClick={() => {
              navigator.clipboard.writeText(commit.summary);
              setCopiedMsg(true);
              setTimeout(() => {
                setCopiedMsg(false);
                onClose();
              }, 500);
            }}
            className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-shark-800 text-slate-300 text-left transition-colors"
          >
            {copiedMsg ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>Copy Commit Summary</span>
          </button>
        </div>
      )}
    </div>
  );
};
