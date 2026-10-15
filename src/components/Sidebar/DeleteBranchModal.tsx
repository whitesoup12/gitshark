import React, { useEffect, useRef } from "react";
import { AlertTriangle, Trash2, X, Loader2, GitBranch, Globe } from "lucide-react";

export interface DeleteBranchModalProps {
  isOpen: boolean;
  branchName: string;
  isRemote: boolean;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteBranchModal: React.FC<DeleteBranchModalProps> = ({
  isOpen,
  branchName,
  isRemote,
  isDeleting,
  onConfirm,
  onCancel,
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus confirm button when modal opens
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
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex-shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {isRemote ? "Delete Remote Tracking Branch" : "Delete Local Branch"}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isRemote ? "Remove remote reference" : "Permanent branch removal"}
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

          {/* Warning Message */}
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
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-shark-800 bg-shark-950/50">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors text-xs font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition-colors shadow-sm shadow-rose-900/50 disabled:opacity-50 cursor-pointer"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Branch</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
