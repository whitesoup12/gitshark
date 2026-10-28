import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Trash2, X, Loader2, GitBranch, Globe, Layers } from "lucide-react";
import { WorktreeItem } from "@/types/worktree";

export interface DeleteBranchModalProps {
  isOpen: boolean;
  branchName: string;
  isRemote: boolean;
  isDeleting: boolean;
  worktrees?: WorktreeItem[];
  onConfirm: (options?: { removeWorktreePath?: string }) => void;
  onCancel: () => void;
}

export const DeleteBranchModal: React.FC<DeleteBranchModalProps> = ({
  isOpen,
  branchName,
  isRemote,
  isDeleting,
  worktrees,
  onConfirm,
  onCancel,
}) => {
  const [removeAssociatedWorktree, setRemoveAssociatedWorktree] = useState(true);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const cleanName = branchName.replace(/^refs\/heads\//, "").replace(/^refs\/remotes\//, "");

  const associatedWorktree =
    !isRemote && worktrees
      ? worktrees.find(
          (w) =>
            w.branch === cleanName ||
            w.branch === branchName ||
            w.branch === `refs/heads/${cleanName}` ||
            (w.branch && w.branch.endsWith(`/${cleanName}`))
        )
      : undefined;

  const isMain = associatedWorktree?.is_main ?? false;

  useEffect(() => {
    if (!isOpen) return;

    confirmBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (associatedWorktree && !isMain && removeAssociatedWorktree) {
      onConfirm({ removeWorktreePath: associatedWorktree.path });
    } else {
      onConfirm();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          onCancel();
        }
      }}
    >
      <div
        className="w-full max-w-md bg-shark-900 border border-shark-750 rounded-xl shadow-2xl overflow-hidden flex flex-col text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-shark-800 bg-shark-950/60">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg border flex-shrink-0 ${
                isMain
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-400"
              }`}
            >
              {isMain ? <AlertTriangle className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {isMain
                  ? "Cannot Delete Active Branch"
                  : isRemote
                  ? "Delete Remote Tracking Branch"
                  : "Delete Local Branch"}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isMain
                  ? "Branch checked out in main workspace"
                  : isRemote
                  ? "Remove remote reference"
                  : "Permanent branch removal"}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors disabled:opacity-50"
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Target Branch Card */}
          <div className="p-3 rounded-lg bg-shark-950 border border-shark-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5 truncate flex-1 mr-2">
              {isRemote ? (
                <Globe className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              ) : (
                <GitBranch className="w-4 h-4 text-sky-400 flex-shrink-0" />
              )}
              <span className="font-mono font-semibold text-slate-100 truncate text-xs">
                {branchName}
              </span>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border font-medium ${
                isRemote
                  ? "bg-indigo-950 text-indigo-300 border-indigo-800/60"
                  : "bg-sky-950 text-sky-300 border-sky-800/60"
              }`}
            >
              {isRemote ? "remote" : "local"}
            </span>
          </div>

          {/* Active Branch in Main Workspace Warning */}
          {isMain ? (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-950/30 border border-amber-900/50 text-amber-200 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-amber-300">
                  Active branch cannot be deleted
                </p>
                <p className="text-[11px] text-amber-300/80">
                  Branch <span className="font-mono font-semibold text-amber-200">{branchName}</span> is currently checked out as the active branch in your workspace. Switch to another branch before deleting it.
                </p>
              </div>
            </div>
          ) : associatedWorktree ? (
            /* Linked Worktree Association Alert */
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-950/30 border border-amber-900/50 text-amber-200 leading-relaxed">
                <Layers className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <p className="font-medium text-amber-300">
                    Checked out in linked worktree
                  </p>
                  <p className="text-[11px] text-amber-300/80">
                    This branch is checked out at:
                  </p>
                  <div className="font-mono text-[10px] px-2 py-1 rounded bg-black/40 border border-amber-900/40 text-slate-200 break-all select-all">
                    {associatedWorktree.path}
                  </div>
                  <p className="text-[11px] text-amber-300/70">
                    Git does not allow deleting a branch that is checked out in a worktree. To delete this branch, its worktree must be removed first.
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-shark-950 border border-shark-800 hover:border-shark-750 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={removeAssociatedWorktree}
                  onChange={(e) => setRemoveAssociatedWorktree(e.target.checked)}
                  disabled={isDeleting}
                  className="mt-0.5 rounded bg-shark-900 border-shark-700 text-rose-500 focus:ring-0"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-slate-200">
                    Also remove associated worktree
                  </span>
                  <p className="text-[10px] text-slate-400">
                    Removes the linked worktree and unlinks the branch so it can be cleanly deleted.
                  </p>
                </div>
              </label>
            </div>
          ) : (
            /* Standard Warning Message */
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-950/30 border border-rose-900/50 text-rose-200 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-rose-300">
                  Are you sure you want to delete this branch?
                </p>
                <p className="text-[11px] text-rose-300/80">
                  {isRemote
                    ? `This will remove the remote tracking branch reference "${branchName}" from your local repository.`
                    : `Branch "${branchName}" and its unmerged working references may be permanently lost. This cannot be undone.`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-shark-800 bg-shark-950/50">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors text-xs font-medium disabled:opacity-50"
          >
            {isMain ? "Close" : "Cancel"}
          </button>
          {!isMain && (
            <button
              ref={confirmBtnRef}
              onClick={handleConfirm}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition-colors shadow-sm shadow-rose-900/50 disabled:opacity-50 cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : associatedWorktree && removeAssociatedWorktree ? (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Worktree & Delete Branch</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Branch</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
