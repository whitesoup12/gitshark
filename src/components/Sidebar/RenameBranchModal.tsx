import React, { useState, useEffect, useRef } from "react";
import { Edit3, X, Loader2, GitBranch, AlertCircle, Info } from "lucide-react";

export interface RenameBranchModalProps {
  isOpen: boolean;
  currentName: string;
  existingBranches: string[];
  isRenaming: boolean;
  onConfirm: (newName: string) => Promise<void> | void;
  onCancel: () => void;
}

export const RenameBranchModal: React.FC<RenameBranchModalProps> = ({
  isOpen,
  currentName,
  existingBranches,
  isRenaming,
  onConfirm,
  onCancel,
}) => {
  const [newName, setNewName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNewName(currentName);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, currentName]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isRenaming) {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isRenaming, onCancel]);

  if (!isOpen) return null;

  const trimmed = newName.trim();

  // Validation logic
  let validationError: string | null = null;
  if (!trimmed) {
    validationError = "Branch name cannot be empty.";
  } else if (trimmed === currentName) {
    validationError = "New name is identical to the current branch name.";
  } else if (
    existingBranches.some(
      (b) => b.toLowerCase() === trimmed.toLowerCase() && b !== currentName
    )
  ) {
    validationError = `A branch named '${trimmed}' already exists.`;
  } else if (
    trimmed.includes(" ") ||
    trimmed.includes("..") ||
    trimmed.includes("~") ||
    trimmed.includes("^") ||
    trimmed.includes(":") ||
    trimmed.includes("?") ||
    trimmed.includes("*") ||
    trimmed.includes("[") ||
    trimmed.includes("\\") ||
    trimmed.startsWith("/") ||
    trimmed.endsWith("/") ||
    trimmed.endsWith(".lock") ||
    trimmed.includes("@{")
  ) {
    validationError = "Contains invalid git branch characters.";
  }

  const isValid = !validationError && !isRenaming;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      onConfirm(trimmed);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isRenaming) {
          onCancel();
        }
      }}
    >
      <div
        className="w-full max-w-md bg-shark-900 border border-shark-750 rounded-xl shadow-2xl overflow-hidden flex flex-col text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-shark-800 bg-shark-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex-shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Rename Local Branch
              </h3>
              <p className="text-[11px] text-slate-400">
                Rename a local branch before pushing to origin
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isRenaming}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors disabled:opacity-50"
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4 text-xs">
            {/* Current branch info */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-shark-950 border border-shark-800 text-slate-400">
              <div className="flex items-center gap-2 truncate">
                <GitBranch className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span className="text-[11px] text-slate-400">Current name:</span>
                <span className="font-mono font-medium text-slate-200 truncate">
                  {currentName}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border font-medium bg-sky-950 text-sky-300 border-sky-800/60">
                local only
              </span>
            </div>

            {/* Input field */}
            <div className="space-y-1.5">
              <label
                htmlFor="rename-branch-input"
                className="block text-[11px] font-medium text-slate-300"
              >
                New Branch Name
              </label>
              <input
                id="rename-branch-input"
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. feature/shark-mode"
                disabled={isRenaming}
                className={`w-full px-3 py-2 bg-shark-950 border rounded-lg text-xs font-mono text-slate-100 placeholder-slate-500 outline-none transition-colors ${
                  validationError && trimmed !== currentName && trimmed !== ""
                    ? "border-rose-500 focus:border-rose-500"
                    : "border-shark-750 focus:border-sky-500"
                }`}
                autoComplete="off"
                spellCheck={false}
              />

              {validationError && trimmed !== currentName && (
                <div className="flex items-center gap-1.5 text-rose-400 text-[11px] pt-0.5">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>

            {/* Note banner */}
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-sky-950/20 border border-sky-900/40 text-slate-300 text-[11px] leading-relaxed">
              <Info className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
              <span>
                Because this branch hasn't been pushed to remote, renaming it locally is safe and keeps commit history intact.
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-shark-800 bg-shark-950/50">
            <button
              type="button"
              onClick={onCancel}
              disabled={isRenaming}
              className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors text-xs font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white font-medium text-xs transition-colors shadow-sm shadow-sky-900/50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isRenaming ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Renaming...</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Rename Branch</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
