import React, { useState, useRef } from "react";
import { FileStatusItem, WorkingTreeStatus, Tab } from "@/types";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import {
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  FileText,
  RotateCcw,
  GitCommit,
  ShieldCheck,
  Loader2,
  ArrowUp,
  Archive,
} from "lucide-react";

interface StagingManagerProps {
  tab?: Tab;
  status: WorkingTreeStatus;
  selectedFilePath: string | null;
  selectedFileStaged: boolean;
  onSelectFile: (path: string, staged: boolean) => void;
  onStageFile: (path: string) => void;
  onUnstageFile: (path: string) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onDiscardFile: (path: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const StagingManager: React.FC<StagingManagerProps> = ({
  tab,
  status,
  selectedFilePath,
  selectedFileStaged,
  onSelectFile,
  onStageFile,
  onUnstageFile,
  onStageAll,
  onUnstageAll,
  onDiscardFile,
  onRefresh,
  isLoading = false,
}) => {
  const {
    executeCommit,
    executePush,
    fetchRemoteSyncStatus,
    fetchBranches,
    createStash,
    fetchStashes,
  } = useWorkspaceStore();

  // Separate Commit Summary and Description
  const [commitSummary, setCommitSummary] = useState("");
  const [commitDescription, setCommitDescription] = useState("");
  const [isAmend, setIsAmend] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  // Stash dialog state
  const [isStashing, setIsStashing] = useState(false);
  const [stashMessage, setStashMessage] = useState("");
  const [stashIncludeUntracked, setStashIncludeUntracked] = useState(true);
  const [isSubmittingStash, setIsSubmittingStash] = useState(false);

  // Split view ratio for Staged vs Unstaged files (default 50/50)
  const [splitRatio, setSplitRatio] = useState<number>(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = moveEvent.clientY - rect.top;
      const newPercent = Math.min(Math.max((relativeY / rect.height) * 100, 15), 85);
      setSplitRatio(newPercent);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const isCommitting = tab?.hookState?.status === "running";
  const stagedCount = status.staged.length;
  const unstagedCount = status.unstaged.length;

  const untrackedCount = status.untracked.length;
  const totalUnstaged = unstagedCount + untrackedCount;

  const renderFileRow = (item: FileStatusItem, isStaged: boolean) => {
    const isSelected =
      selectedFilePath === item.path && selectedFileStaged === isStaged;

    let badgeText = "M";
    let badgeColor = "bg-amber-950 text-amber-400 border-amber-800/60";

    if (item.status === "new" || item.status === "untracked") {
      badgeText = "A";
      badgeColor = "bg-emerald-950 text-emerald-400 border-emerald-800/60";
    } else if (item.status === "deleted") {
      badgeText = "D";
      badgeColor = "bg-rose-950 text-rose-400 border-rose-800/60";
    } else if (item.status === "renamed") {
      badgeText = "R";
      badgeColor = "bg-sky-950 text-sky-400 border-sky-800/60";
    }

    const fileName = item.path.split(/[/\\]/).pop() || item.path;
    const dirName = item.path.includes("/") || item.path.includes("\\")
      ? item.path.substring(0, Math.max(item.path.lastIndexOf("/"), item.path.lastIndexOf("\\")))
      : "";

    return (
      <div
        key={`${isStaged ? "staged" : "unstaged"}-${item.path}`}
        onClick={() => onSelectFile(item.path, isStaged)}
        className={`group flex items-center justify-between px-2.5 py-1.5 text-xs rounded transition-colors cursor-pointer select-none ${
          isSelected
            ? "bg-sky-500/15 text-sky-200 border-l-2 border-sky-400 font-medium"
            : "hover:bg-shark-800/70 text-slate-300 border-l-2 border-transparent"
        }`}
      >
        <div className="flex items-center gap-2 truncate flex-1 mr-2">
          <span
            className={`w-4 h-4 rounded text-[10px] font-mono font-bold flex items-center justify-center border flex-shrink-0 ${badgeColor}`}
          >
            {badgeText}
          </span>
          <span className="truncate font-medium">{fileName}</span>
          {dirName && (
            <span className="text-[10px] text-slate-500 truncate">{dirName}</span>
          )}
        </div>

        {/* Hover Action Buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isStaged ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUnstageFile(item.path);
              }}
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-shark-750 transition-colors"
              title="Unstage file"
            >
              <Minus className="w-3 h-3" />
            </button>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDiscardFile(item.path);
                }}
                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-shark-750 transition-colors"
                title="Discard changes"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStageFile(item.path);
                }}
                className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-shark-750 transition-colors"
                title="Stage file"
              >
                <Plus className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const handleCommit = async () => {
    if (!tab || isCommitting) return;
    const summary = commitSummary.trim();
    const desc = commitDescription.trim();
    if (!isAmend && stagedCount === 0) return;
    if (!isAmend && !summary) return;

    const fullMessage = desc ? `${summary}\n\n${desc}` : summary;
    const success = await executeCommit(tab.id, fullMessage, isAmend);
    if (success && !isAmend) {
      setCommitSummary("");
      setCommitDescription("");
    }
  };

  const handleSaveStash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tab || isSubmittingStash) return;

    setIsSubmittingStash(true);
    try {
      const success = await createStash(
        tab.id,
        stashMessage.trim() || undefined,
        stashIncludeUntracked
      );
      if (success) {
        setStashMessage("");
        setIsStashing(false);
        onRefresh();
      }
    } finally {
      setIsSubmittingStash(false);
    }
  };

  return (
    <aside className="w-80 flex flex-col bg-shark-900 border-r border-shark-800 h-full select-none text-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-shark-800 bg-shark-950/40">
        <span className="font-semibold text-slate-200">Changes & Staging</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsStashing((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              isStashing
                ? "bg-sky-950 text-sky-300 border border-sky-800"
                : "bg-shark-800 hover:bg-shark-750 text-slate-300 hover:text-sky-300 border border-shark-700"
            }`}
            title="Stash working changes (git stash push)"
          >
            <Archive className="w-3 h-3 text-sky-400" />
            <span>Stash</span>
          </button>

          <button
            onClick={onRefresh}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-shark-800 transition-colors"
            title="Refresh working directory status"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-sky-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Inline Stash Creation Form */}
      {isStashing && (
        <form
          onSubmit={handleSaveStash}
          className="p-2.5 bg-shark-950 border-b border-shark-800 space-y-2 select-none shadow-md flex-shrink-0 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold text-sky-300 flex items-center gap-1">
              <Archive className="w-3 h-3" />
              <span>Stash Changes</span>
            </div>
            <button
              type="button"
              onClick={() => setIsStashing(false)}
              className="text-[10px] text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>

          <input
            type="text"
            value={stashMessage}
            onChange={(e) => setStashMessage(e.target.value)}
            placeholder="Stash message (optional, e.g. WIP)"
            className="w-full px-2 py-1 bg-shark-900 border border-shark-750 focus:border-sky-500 rounded text-[11px] font-mono text-slate-200 outline-none"
            autoFocus
          />

          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={stashIncludeUntracked}
                onChange={(e) => setStashIncludeUntracked(e.target.checked)}
                className="rounded bg-shark-900 border-shark-700 text-sky-500"
              />
              <span>Include untracked</span>
            </label>

            <button
              type="submit"
              disabled={isSubmittingStash}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-medium text-[10px]"
            >
              {isSubmittingStash ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <span>Save Stash</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Split Container for Staged and Unstaged Files */}
      <div ref={containerRef} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Top Panel: Staged Changes */}
        <div
          style={{ height: `${splitRatio}%` }}
          className="flex flex-col min-h-0 overflow-hidden"
        >
          {/* Staged Header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-shark-800 bg-shark-950/40 select-none flex-shrink-0">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300 text-[11px]">
              <span>Staged Changes</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 font-mono">
                {stagedCount}
              </span>
            </div>
            {stagedCount > 0 && (
              <button
                onClick={onUnstageAll}
                className="text-[11px] text-slate-400 hover:text-slate-200 hover:underline"
              >
                Unstage All
              </button>
            )}
          </div>

          {/* Staged Scroll List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
            {stagedCount === 0 ? (
              <div className="px-3 py-3 text-slate-500 italic text-[11px]">
                No staged changes
              </div>
            ) : (
              status.staged.map((f) => renderFileRow(f, true))
            )}
          </div>
        </div>

        {/* Resizable Divider Bar */}
        <div
          onMouseDown={handleDividerMouseDown}
          className="h-2 hover:h-2.5 bg-shark-850 hover:bg-sky-600/40 border-y border-shark-750/60 cursor-row-resize transition-all flex items-center justify-center flex-shrink-0 group z-10"
          title="Drag up or down to resize Staged / Unstaged view"
        >
          <div className="w-8 h-0.5 bg-slate-500 group-hover:bg-sky-400 rounded-full" />
        </div>

        {/* Bottom Panel: Unstaged Changes */}
        <div
          style={{ height: `${100 - splitRatio}%` }}
          className="flex flex-col min-h-0 overflow-hidden"
        >
          {/* Unstaged Header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-shark-800 bg-shark-950/40 select-none flex-shrink-0">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300 text-[11px]">
              <span>Unstaged Changes</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950/70 border border-amber-800/60 text-amber-300 font-mono">
                {totalUnstaged}
              </span>
            </div>
            {totalUnstaged > 0 && (
              <button
                onClick={onStageAll}
                className="text-[11px] text-sky-400 hover:text-sky-300 hover:underline"
              >
                Stage All
              </button>
            )}
          </div>

          {/* Unstaged Scroll List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
            {totalUnstaged === 0 ? (
              <div className="px-3 py-3 text-slate-500 italic text-[11px] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Working tree clean</span>
              </div>
            ) : (
              <>
                {status.unstaged.map((f) => renderFileRow(f, false))}
                {status.untracked.map((f) => renderFileRow(f, false))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Commit Box */}
      <div className="p-3 border-t border-shark-800 bg-shark-950/60 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-300 text-[11px]">Commit</span>
          {tab?.hooksInfo && tab.hooksInfo.active_hooks.length > 0 && (
            <div
              className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono"
              title={`Active hooks: ${tab.hooksInfo.active_hooks.map((h) => h.name).join(", ")}`}
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>{tab.hooksInfo.has_pre_commit ? "pre-commit" : "hooks"} active</span>
            </div>
          )}
        </div>

        {/* Separate Commit Summary and Description Fields */}
        <div className="space-y-1.5">
          <input
            type="text"
            value={commitSummary}
            onChange={(e) => setCommitSummary(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                handleCommit();
              }
            }}
            placeholder="Commit summary (required)"
            disabled={isCommitting}
            className="w-full bg-shark-900 border border-shark-750 focus:border-sky-500 rounded px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none font-semibold transition-colors"
          />

          <textarea
            value={commitDescription}
            onChange={(e) => setCommitDescription(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                handleCommit();
              }
            }}
            placeholder="Description (optional details, Ctrl+Enter)..."
            rows={2}
            disabled={isCommitting}
            className="w-full bg-shark-900 border border-shark-750 focus:border-sky-500 rounded p-2 text-xs text-slate-300 placeholder-slate-500 resize-none outline-none font-mono transition-colors"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none hover:text-slate-200">
            <input
              type="checkbox"
              checked={isAmend}
              onChange={(e) => setIsAmend(e.target.checked)}
              disabled={isCommitting}
              className="rounded bg-shark-900 border-shark-700 text-sky-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Amend</span>
          </label>

          <button
            onClick={handleCommit}
            disabled={
              isCommitting ||
              (!isAmend && stagedCount === 0) ||
              (!isAmend && !commitSummary.trim())
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white font-medium text-xs shadow transition-colors"
          >
            {isCommitting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Hooks Running...</span>
              </>
            ) : (
              <>
                <GitCommit className="w-3.5 h-3.5" />
                <span>
                  {isAmend ? "Amend Commit" : `Commit (${stagedCount})`}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Unpushed Commits Quick-Push Banner */}
        {tab?.remoteSync && tab.remoteSync.ahead > 0 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-shark-800 text-[11px]">
            <span className="text-slate-400">
              <strong className="text-sky-400 font-mono">{tab.remoteSync.ahead}</strong> unpushed commit{tab.remoteSync.ahead > 1 ? "s" : ""}
            </span>
            <button
              onClick={async () => {
                if (!tab.repoId || isPushing) return;
                setIsPushing(true);
                try {
                  await executePush(tab.id);
                  await fetchRemoteSyncStatus(tab.id);
                  await fetchBranches(tab.id);
                } finally {
                  setIsPushing(false);
                }
              }}
              disabled={isPushing}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-sky-950/70 border border-sky-700/50 text-sky-300 hover:bg-sky-900/60 font-medium text-[10px] transition-colors disabled:opacity-50"
            >
              <ArrowUp className={`w-2.5 h-2.5 ${isPushing ? "animate-bounce" : ""}`} />
              <span>{isPushing ? "Pushing..." : "Push now"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer Summary */}
      <div className="px-3 py-2 border-t border-shark-800 bg-shark-950/40 text-[11px] text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <FileText className="w-3.5 h-3.5 text-slate-500" />
          <span>{stagedCount + totalUnstaged} total files modified</span>
        </div>
      </div>
    </aside>
  );
};

