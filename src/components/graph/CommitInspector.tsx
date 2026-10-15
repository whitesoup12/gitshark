import React, { useState, useEffect } from "react";
import { CommitNode, CommitDetails, CommitFileChange, FileDiff } from "@/types";
import {
  Copy,
  Check,
  X,
  GitCommit,
  User,
  Calendar,
  GitFork,
  Maximize2,
  Minimize2,
  ArrowLeft,
  FileText,
  Loader2,
  Bookmark,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { formatShortHash } from "@/lib/utils";
import { getCommitDetailsIpc, getCommitFileDiffIpc } from "@/lib/ipc";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";

interface CommitInspectorProps {
  repoId: string;
  commit: CommitNode;
  onClose: () => void;
  onSelectCommit: (hash: string) => void;
}

export const CommitInspector: React.FC<CommitInspectorProps> = ({
  repoId,
  commit,
  onClose,
  onSelectCommit,
}) => {
  const { activeTabId, createTag, deleteTag, pushTag } = useWorkspaceStore();
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [details, setDetails] = useState<CommitDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Tag creation state
  const [showTagForm, setShowTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagMessage, setNewTagMessage] = useState("");
  const [pushTagToRemote, setPushTagToRemote] = useState(false);
  const [isSubmittingTag, setIsSubmittingTag] = useState(false);
  const [pushingTagName, setPushingTagName] = useState<string | null>(null);

  // Selected file for diff preview inside the commit
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<FileDiff | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState<"unified" | "split">("unified");

  // Vertical panel height resizing
  const [inspectorHeight, setInspectorHeight] = useState<number>(() => {
    const saved = localStorage.getItem("gitshark_commit_inspector_height");
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 160 && parsed <= 900) {
        return parsed;
      }
    }
    return 288;
  });
  const [isResizingHeight, setIsResizingHeight] = useState(false);

  const handleHeightResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingHeight(true);
    const startY = e.clientY;
    const startHeight = inspectorHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const maxHeight = Math.round(window.innerHeight * 0.85);
      const newHeight = Math.min(Math.max(startHeight + delta, 160), maxHeight);
      setInspectorHeight(newHeight);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsResizingHeight(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      const delta = startY - upEvent.clientY;
      const maxHeight = Math.round(window.innerHeight * 0.85);
      const finalHeight = Math.min(Math.max(startHeight + delta, 160), maxHeight);
      localStorage.setItem("gitshark_commit_inspector_height", String(finalHeight));
    };

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleResetHeight = () => {
    setInspectorHeight(288);
    localStorage.setItem("gitshark_commit_inspector_height", "288");
  };

  // Horizontal left column width resizing
  const [leftColWidth, setLeftColWidth] = useState<number>(() => {
    const saved = localStorage.getItem("gitshark_commit_inspector_left_width");
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 200 && parsed <= 600) {
        return parsed;
      }
    }
    return 320;
  });
  const [isResizingLeftCol, setIsResizingLeftCol] = useState(false);

  const handleLeftColResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeftCol(true);
    const startX = e.clientX;
    const startWidth = leftColWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.min(Math.max(startWidth + delta, 200), 600);
      setLeftColWidth(newWidth);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsResizingLeftCol(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      const delta = upEvent.clientX - startX;
      const finalWidth = Math.min(Math.max(startWidth + delta, 200), 600);
      localStorage.setItem("gitshark_commit_inspector_left_width", String(finalWidth));
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleResetLeftCol = () => {
    setLeftColWidth(320);
    localStorage.setItem("gitshark_commit_inspector_left_width", "320");
  };

  // Load commit details (changed files + stats) whenever commit hash changes
  useEffect(() => {
    setSelectedFile(null);
    setFileDiff(null);
    if (!repoId || !commit.hash) return;

    let isMounted = true;
    setIsLoadingDetails(true);

    getCommitDetailsIpc(repoId, commit.hash)
      .then((data) => {
        if (isMounted) {
          setDetails(data);
        }
      })
      .catch((err) => {
        console.warn("Failed to load commit details:", err);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingDetails(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [repoId, commit.hash]);

  // Load specific file diff when user clicks a changed file
  useEffect(() => {
    if (!repoId || !commit.hash || !selectedFile) {
      setFileDiff(null);
      return;
    }

    let isMounted = true;
    setIsLoadingDiff(true);

    getCommitFileDiffIpc(repoId, commit.hash, selectedFile)
      .then((data) => {
        if (isMounted) {
          setFileDiff(data);
        }
      })
      .catch((err) => {
        console.warn("Failed to load commit file diff:", err);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingDiff(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [repoId, commit.hash, selectedFile]);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(commit.hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim() || isSubmittingTag || !activeTabId) return;

    setIsSubmittingTag(true);
    try {
      const success = await createTag(
        activeTabId,
        newTagName.trim(),
        commit.hash,
        newTagMessage.trim() || undefined,
        pushTagToRemote
      );
      if (success) {
        setNewTagName("");
        setNewTagMessage("");
        setPushTagToRemote(false);
        setShowTagForm(false);
      }
    } finally {
      setIsSubmittingTag(false);
    }
  };

  const handleDeleteTag = async (name: string) => {
    if (!activeTabId) return;
    if (window.confirm(`Are you sure you want to delete tag '${name}'?`)) {
      await deleteTag(activeTabId, name);
    }
  };

  const handlePushTag = async (name: string) => {
    if (!activeTabId) return;
    setPushingTagName(name);
    try {
      await pushTag(activeTabId, name);
    } finally {
      setPushingTagName(null);
    }
  };

  const formattedDate = new Date(commit.timestamp * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "added":
        return <span className="w-4 h-4 rounded text-[10px] font-mono font-bold flex items-center justify-center bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex-shrink-0">A</span>;
      case "deleted":
        return <span className="w-4 h-4 rounded text-[10px] font-mono font-bold flex items-center justify-center bg-rose-950 text-rose-400 border border-rose-800/60 flex-shrink-0">D</span>;
      case "renamed":
        return <span className="w-4 h-4 rounded text-[10px] font-mono font-bold flex items-center justify-center bg-sky-950 text-sky-400 border border-sky-800/60 flex-shrink-0">R</span>;
      default:
        return <span className="w-4 h-4 rounded text-[10px] font-mono font-bold flex items-center justify-center bg-amber-950 text-amber-400 border border-amber-800/60 flex-shrink-0">M</span>;
    }
  };

  return (
    <div
      style={{
        height: isExpanded ? "65vh" : `${inspectorHeight}px`,
      }}
      className={`border-t border-shark-800 bg-shark-900/95 flex flex-col text-xs select-none z-10 relative flex-shrink-0 ${
        isResizingHeight ? "" : "transition-[height] duration-200"
      }`}
    >
      {/* Draggable top resize handle for commit inspector */}
      <div
        onMouseDown={handleHeightResizeMouseDown}
        onDoubleClick={handleResetHeight}
        className="absolute -top-1 left-0 w-full h-2.5 cursor-row-resize hover:bg-sky-500/30 active:bg-sky-500/50 transition-colors z-20 group"
        title="Drag to resize inspector height (Double-click to reset)"
      >
        <div className="h-[1px] w-full my-auto bg-transparent group-hover:bg-sky-400/80 transition-colors" />
      </div>

      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-shark-800 bg-shark-950/70 flex-shrink-0">
        <div className="flex items-center gap-2.5 truncate">
          <GitCommit className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <span className="font-semibold text-slate-200 truncate">{commit.summary}</span>

          <button
            onClick={handleCopyHash}
            className="flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-shark-800 hover:bg-shark-750 text-slate-300 border border-shark-700 transition-colors flex-shrink-0"
            title="Copy full 40-character SHA"
          >
            <span>{formatShortHash(commit.hash)}</span>
            {copied ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 text-slate-400" />
            )}
          </button>

          <button
            onClick={() => setShowTagForm((prev) => !prev)}
            className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border transition-colors flex-shrink-0 ${
              showTagForm
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                : "bg-shark-800 hover:bg-shark-750 text-slate-300 border-shark-700 hover:text-amber-300"
            }`}
            title="Create tag on this commit"
          >
            <Bookmark className="w-3 h-3 text-amber-400" />
            <span>Tag</span>
          </button>

          {details && (
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono flex-shrink-0">
              <span className="text-emerald-400">+{details.total_additions}</span>
              <span className="text-rose-400">-{details.total_deletions}</span>
              <span className="text-slate-500">
                ({details.files.length} {details.files.length === 1 ? "file" : "files"})
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-shark-800 transition-colors"
            title={isExpanded ? "Collapse inspector" : "Expand inspector"}
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-shark-800 transition-colors"
            title="Close details"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inline Tag Creation Bar */}
      {showTagForm && (
        <form
          onSubmit={handleCreateTag}
          className="px-4 py-2 bg-shark-950 border-b border-shark-800 flex flex-wrap items-center gap-2 text-xs flex-shrink-0"
        >
          <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium">
            <Bookmark className="w-3.5 h-3.5" />
            <span>New Tag:</span>
          </div>
          <input
            type="text"
            placeholder="Tag name (e.g. v1.0.0)"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            className="px-2 py-1 rounded bg-shark-900 border border-shark-750 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500 w-44"
            autoFocus
            required
          />
          <input
            type="text"
            placeholder="Annotation message (optional)"
            value={newTagMessage}
            onChange={(e) => setNewTagMessage(e.target.value)}
            className="px-2 py-1 rounded bg-shark-900 border border-shark-750 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500 flex-1 min-w-[180px]"
          />
          <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pushTagToRemote}
              onChange={(e) => setPushTagToRemote(e.target.checked)}
              className="rounded bg-shark-900 border-shark-700 text-amber-500"
            />
            <span>Push to remote</span>
          </label>
          <button
            type="submit"
            disabled={!newTagName.trim() || isSubmittingTag}
            className="px-2.5 py-1 rounded text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {isSubmittingTag ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Plus className="w-3 h-3" />
            )}
            <span>Create</span>
          </button>
          <button
            type="button"
            onClick={() => setShowTagForm(false)}
            className="px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Main Inspector Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Column: Author, Message, Parents */}
        <div
          style={{ width: `${leftColWidth}px` }}
          className={`border-r border-shark-800 p-3 overflow-y-auto space-y-3.5 flex-shrink-0 bg-shark-950/20 text-slate-400 text-[11px] relative ${
            isResizingLeftCol ? "" : "transition-[width] duration-150"
          }`}
        >
          {/* Draggable vertical divider */}
          <div
            onMouseDown={handleLeftColResizeMouseDown}
            onDoubleClick={handleResetLeftCol}
            className="absolute top-0 -right-1 w-2.5 h-full cursor-col-resize hover:bg-sky-500/30 active:bg-sky-500/50 transition-colors z-20 group"
            title="Drag to resize commit metadata panel (Double-click to reset)"
          >
            <div className="w-[1px] h-full mx-auto bg-transparent group-hover:bg-sky-400/80 transition-colors" />
          </div>

          {/* Summary & Body */}
          <div className="space-y-1">
            <div className="font-semibold text-slate-200 text-xs leading-snug">
              {commit.summary}
            </div>
            {details?.body && (
              <div className="text-slate-400 text-[11px] whitespace-pre-wrap font-mono bg-shark-950/40 p-2 rounded border border-shark-800">
                {details.body}
              </div>
            )}
          </div>

          {/* References / Badges */}
          {commit.refs && commit.refs.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {commit.refs.map((r) => {
                const isTag = r.kind === "tag";
                return (
                  <span
                    key={r.name}
                    className={`group/ref inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                      isTag
                        ? "bg-amber-950/60 text-amber-300 border-amber-800/50"
                        : "bg-sky-950/60 text-sky-300 border-sky-800/50"
                    }`}
                  >
                    {isTag && <Bookmark className="w-2.5 h-2.5 text-amber-400" />}
                    <span>{r.shorthand}</span>
                    {isTag && (
                      <span className="flex items-center gap-0.5 opacity-0 group-hover/ref:opacity-100 transition-opacity ml-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePushTag(r.shorthand);
                          }}
                          disabled={pushingTagName === r.shorthand}
                          title={`Push tag '${r.shorthand}' to remote origin`}
                          className="hover:text-amber-100"
                        >
                          {pushingTagName === r.shorthand ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <UploadCloud className="w-2.5 h-2.5" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTag(r.shorthand);
                          }}
                          title={`Delete tag '${r.shorthand}'`}
                          className="hover:text-rose-400"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {/* Author info */}
          <div className="space-y-1.5 pt-1 border-t border-shark-800">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span className="text-slate-200 font-medium">{commit.author}</span>
            </div>
            {commit.author_email && (
              <div className="text-slate-500 truncate pl-5">
                &lt;{commit.author_email}&gt;
              </div>
            )}
            <div className="flex items-center gap-2 text-slate-500 pt-0.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span>{formattedDate}</span>
            </div>
          </div>

          {/* Parents */}
          <div className="pt-1 border-t border-shark-800">
            <div className="flex items-center gap-1.5 text-slate-500 mb-1">
              <GitFork className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span>Parents ({commit.parents.length}):</span>
            </div>
            <div className="flex flex-wrap gap-1 pl-5">
              {commit.parents.length > 0 ? (
                commit.parents.map((parentHash) => (
                  <button
                    key={parentHash}
                    onClick={() => onSelectCommit(parentHash)}
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-shark-800 hover:bg-sky-950 hover:text-sky-300 text-slate-300 border border-shark-750 transition-colors"
                    title={`Jump to parent ${parentHash}`}
                  >
                    {parentHash.slice(0, 7)}
                  </button>
                ))
              ) : (
                <span className="italic text-slate-600">Root commit</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Files Changed List OR Active File Diff */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-shark-950/40">
          {/* Subheader */}
          <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-shark-800 bg-shark-950/60 select-none flex-shrink-0">
            {selectedFile ? (
              <div className="flex items-center gap-2 truncate">
                <button
                  onClick={() => setSelectedFile(null)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-shark-800 hover:bg-shark-750 text-slate-300 hover:text-slate-100 transition-colors text-[11px]"
                  title="Return to changed files list"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Files List</span>
                </button>
                <span className="text-slate-500">/</span>
                <span className="font-mono text-slate-200 truncate font-semibold text-xs">
                  {selectedFile}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-semibold text-slate-300 text-xs">
                  Files Changed in this Commit
                </span>
                {details && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800/60 font-mono">
                    {details.files.length}
                  </span>
                )}
              </div>
            )}

            {selectedFile && fileDiff && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <span className="text-emerald-400">+{fileDiff.total_additions}</span>
                  <span className="text-rose-400">-{fileDiff.total_deletions}</span>
                </div>
                <div className="flex items-center bg-shark-850 rounded border border-shark-750 p-0.5">
                  <button
                    onClick={() => setDiffViewMode("unified")}
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      diffViewMode === "unified"
                        ? "bg-sky-500/20 text-sky-300 font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Inline
                  </button>
                  <button
                    onClick={() => setDiffViewMode("split")}
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      diffViewMode === "split"
                        ? "bg-sky-500/20 text-sky-300 font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Split
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-2 min-h-0">
            {isLoadingDetails ? (
              <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                <span>Reading commit changes with git2...</span>
              </div>
            ) : selectedFile ? (
              /* Selected File Diff Content */
              isLoadingDiff ? (
                <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                  <span>Computing file diff hunks...</span>
                </div>
              ) : !fileDiff || fileDiff.hunks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-1 p-4">
                  {fileDiff?.is_binary ? (
                    <span className="font-mono text-xs">Binary file changed (cannot show visual diff)</span>
                  ) : (
                    <span className="font-mono text-xs">File identical or empty diff</span>
                  )}
                </div>
              ) : (
                /* Interactive Hunk Diff Rendering */
                <div className="space-y-3 font-mono text-[11px]">
                  {fileDiff.hunks.map((hunk, hIdx) => (
                    <div
                      key={hIdx}
                      className="border border-shark-800 rounded bg-shark-950/60 overflow-hidden"
                    >
                      {/* Hunk Header */}
                      <div className="px-3 py-1 bg-shark-900 border-b border-shark-800 text-sky-400 font-medium text-[10px]">
                        {hunk.header}
                      </div>

                      {/* Hunk Lines */}
                      <div className="overflow-x-auto">
                        {hunk.lines.map((line, lIdx) => {
                          const isAdd = line.origin === "+";
                          const isDel = line.origin === "-";
                          return (
                            <div
                              key={lIdx}
                              className={`flex items-center leading-5 ${
                                isAdd
                                  ? "bg-emerald-950/30 text-emerald-300"
                                  : isDel
                                  ? "bg-rose-950/30 text-rose-300"
                                  : "text-slate-400"
                              }`}
                            >
                              <span className="w-10 text-right pr-2 text-slate-600 select-none text-[10px]">
                                {line.old_lineno ?? ""}
                              </span>
                              <span className="w-10 text-right pr-2 text-slate-600 select-none text-[10px]">
                                {line.new_lineno ?? ""}
                              </span>
                              <span className="w-5 text-center select-none font-bold">
                                {line.origin === "+" || line.origin === "-"
                                  ? line.origin
                                  : " "}
                              </span>
                              <span className="flex-1 pr-3 whitespace-pre overflow-x-auto">
                                {line.content}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Changed Files List */
              !details || details.files.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-500 italic text-xs">
                  No changed files recorded for this commit
                </div>
              ) : (
                <div className="space-y-0.5">
                  {details.files.map((file: CommitFileChange) => {
                    const fileName = file.path.split(/[/\\]/).pop() || file.path;
                    const dirName = file.path.includes("/") || file.path.includes("\\")
                      ? file.path.substring(0, Math.max(file.path.lastIndexOf("/"), file.path.lastIndexOf("\\")))
                      : "";

                    return (
                      <div
                        key={file.path}
                        onClick={() => setSelectedFile(file.path)}
                        className="group flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-shark-800/70 border border-transparent hover:border-shark-750 transition-colors cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2 truncate flex-1 mr-2">
                          {getStatusBadge(file.status)}
                          <span className="font-medium text-slate-200 group-hover:text-sky-300 transition-colors truncate">
                            {fileName}
                          </span>
                          {dirName && (
                            <span className="text-[10px] text-slate-500 truncate">
                              {dirName}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="flex items-center gap-1 font-mono text-[10px]">
                            {file.additions > 0 && (
                              <span className="text-emerald-400">+{file.additions}</span>
                            )}
                            {file.deletions > 0 && (
                              <span className="text-rose-400">-{file.deletions}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 hover:text-sky-300 transition-opacity">
                            view diff →
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
