import React, { useState, useEffect } from "react";
import { Tab, StashItem, StashDetails, FileDiff } from "@/types";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { formatShortHash } from "@/lib/utils";
import {
  Archive,
  X,
  Copy,
  Check,
  Search,
  FileText,
  Loader2,
  Trash2,
  Play,
  ArrowDownToLine,
  FileCode,
} from "lucide-react";

interface StashInspectorModalProps {
  tab: Tab;
  stash: StashItem;
  initialFilePath?: string;
  onClose: () => void;
  onApply: (index: number, pop: boolean) => Promise<void>;
  onDrop: (stash: StashItem) => Promise<void>;
}

export const StashInspectorModal: React.FC<StashInspectorModalProps> = ({
  tab,
  stash,
  initialFilePath,
  onClose,
  onApply,
  onDrop,
}) => {
  const { fetchStashDetails, fetchStashFileDiff } = useWorkspaceStore();

  const [details, setDetails] = useState<StashDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(initialFilePath || null);
  const [fileDiff, setFileDiff] = useState<FileDiff | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [diffViewMode, setDiffViewMode] = useState<"unified" | "split">("unified");
  const [copiedSha, setCopiedSha] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);

  // Load stash details
  useEffect(() => {
    let active = true;
    setIsLoadingDetails(true);

    fetchStashDetails(tab.id, stash.index).then((res) => {
      if (!active) return;
      setIsLoadingDetails(false);
      setDetails(res);
      if (res && res.files.length > 0) {
        if (initialFilePath && res.files.some((f) => f.path === initialFilePath)) {
          setSelectedFile(initialFilePath);
        } else {
          setSelectedFile(res.files[0].path);
        }
      }
    });

    return () => {
      active = false;
    };
  }, [tab.id, stash.index, initialFilePath, fetchStashDetails]);

  // Load diff for selected file
  useEffect(() => {
    if (!selectedFile) {
      setFileDiff(null);
      return;
    }

    let active = true;
    setIsLoadingDiff(true);

    fetchStashFileDiff(tab.id, stash.index, selectedFile).then((res) => {
      if (!active) return;
      setIsLoadingDiff(false);
      setFileDiff(res);
    });

    return () => {
      active = false;
    };
  }, [tab.id, stash.index, selectedFile, fetchStashFileDiff]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleCopySha = () => {
    if (!stash.commit_id) return;
    navigator.clipboard.writeText(stash.commit_id);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  const handleApplyAction = async (pop: boolean) => {
    setIsActionPending(true);
    try {
      await onApply(stash.index, pop);
      if (pop) {
        onClose();
      }
    } finally {
      setIsActionPending(false);
    }
  };

  const handleDropAction = async () => {
    setIsActionPending(true);
    try {
      await onDrop(stash);
      onClose();
    } finally {
      setIsActionPending(false);
    }
  };

  const filteredFiles = (details?.files || []).filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return f.path.toLowerCase().includes(q) || (f.old_path && f.old_path.toLowerCase().includes(q));
  });

  const getStatusBadge = (status: string, isUntracked: boolean) => {
    if (isUntracked) {
      return (
        <span className="w-4 h-4 rounded flex items-center justify-center font-bold text-[9px] bg-purple-500/20 text-purple-400 border border-purple-500/30 flex-shrink-0" title="Untracked file">
          U
        </span>
      );
    }
    switch (status) {
      case "added":
        return (
          <span className="w-4 h-4 rounded flex items-center justify-center font-bold text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0" title="Added file">
            A
          </span>
        );
      case "deleted":
        return (
          <span className="w-4 h-4 rounded flex items-center justify-center font-bold text-[9px] bg-rose-500/20 text-rose-400 border border-rose-500/30 flex-shrink-0" title="Deleted file">
            D
          </span>
        );
      case "renamed":
        return (
          <span className="w-4 h-4 rounded flex items-center justify-center font-bold text-[9px] bg-sky-500/20 text-sky-400 border border-sky-500/30 flex-shrink-0" title="Renamed file">
            R
          </span>
        );
      case "modified":
      default:
        return (
          <span className="w-4 h-4 rounded flex items-center justify-center font-bold text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 flex-shrink-0" title="Modified file">
            M
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="flex flex-col bg-shark-950 border border-shark-800 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] overflow-hidden text-slate-100 font-sans">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-shark-800 bg-shark-900/60 select-none flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-sky-950/90 border border-sky-700/60 flex items-center justify-center text-sky-300 flex-shrink-0 shadow-sm">
              <Archive className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800/80">
                  stash@&#123;{stash.index}&#125;
                </span>
                <span className="font-semibold text-sm text-slate-100 truncate" title={stash.message}>
                  {stash.message || "Working directory stash"}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-0.5">
                <button
                  onClick={handleCopySha}
                  className="flex items-center gap-1 hover:text-slate-200 transition-colors"
                  title="Click to copy full commit SHA"
                >
                  <span>{formatShortHash(stash.commit_id)}</span>
                  {copiedSha ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-500 hover:text-slate-300" />
                  )}
                </button>

                {details && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span>{details.files.length} changed {details.files.length === 1 ? "file" : "files"}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-emerald-400 font-medium">+{details.total_additions}</span>
                    <span className="text-rose-400 font-medium">-{details.total_deletions}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions & Close */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <button
              onClick={() => handleApplyAction(false)}
              disabled={isActionPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-shark-850 hover:bg-sky-950/80 text-slate-200 hover:text-sky-300 border border-shark-750 hover:border-sky-800/80 transition-colors disabled:opacity-50"
              title="Apply stash changes into working directory while preserving stash in list"
            >
              {isActionPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              <span>Apply</span>
            </button>

            <button
              onClick={() => handleApplyAction(true)}
              disabled={isActionPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/80 transition-colors disabled:opacity-50"
              title="Apply stash changes into working directory and remove (pop) it from stash list"
            >
              <ArrowDownToLine className="w-3 h-3" />
              <span>Pop</span>
            </button>

            <button
              onClick={handleDropAction}
              disabled={isActionPending}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 border border-transparent hover:border-rose-800/50 transition-colors disabled:opacity-50"
              title="Permanently drop (delete) this stash"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <div className="w-[1px] h-5 bg-shark-800 mx-1" />

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-shark-800 transition-colors"
              title="Close modal (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Main Body: 2 Columns */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Column: Changed Files List */}
          <div className="w-80 border-r border-shark-800 flex flex-col min-h-0 bg-shark-950/50 flex-shrink-0">
            {/* Search Filter Header */}
            <div className="p-2.5 border-b border-shark-800/80 flex items-center gap-2 bg-shark-900/30 flex-shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter stashed files..."
                className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-slate-500 hover:text-slate-300 text-xs"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Files Scroll Container */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoadingDetails ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
                  <span>Loading stashed files...</span>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-500 italic text-xs">
                  {searchQuery ? "No matching files found" : "No files recorded in this stash"}
                </div>
              ) : (
                filteredFiles.map((file) => {
                  const isSelected = selectedFile === file.path;
                  const fileName = file.path.split(/[/\\]/).pop() || file.path;
                  const dirName = file.path.includes("/") || file.path.includes("\\")
                    ? file.path.substring(0, Math.max(file.path.lastIndexOf("/"), file.path.lastIndexOf("\\")))
                    : "";

                  return (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFile(file.path)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors text-xs select-none border ${
                        isSelected
                          ? "bg-sky-950/70 border-sky-700/80 text-sky-200 shadow-sm"
                          : "hover:bg-shark-900 border-transparent text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate mr-2 flex-1 min-w-0">
                        {getStatusBadge(file.status, file.is_untracked)}
                        <span className="font-medium truncate text-slate-100">
                          {fileName}
                        </span>
                        {dirName && (
                          <span className="text-[10px] text-slate-500 truncate font-mono">
                            {dirName}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 font-mono text-[10px]">
                        {file.additions > 0 && (
                          <span className="text-emerald-400">+{file.additions}</span>
                        )}
                        {file.deletions > 0 && (
                          <span className="text-rose-400">-{file.deletions}</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: File Diff Viewer */}
          <div className="flex-1 flex flex-col min-h-0 bg-shark-950">
            {/* Diff Subheader */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-shark-800 bg-shark-900/40 select-none flex-shrink-0">
              <div className="flex items-center gap-2 truncate flex-1 mr-4">
                <FileText className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                  {selectedFile || "Select a file to inspect diff"}
                </span>
                {fileDiff && (
                  <div className="flex items-center gap-1.5 ml-2 font-mono text-xs flex-shrink-0">
                    <span className="text-emerald-400">+{fileDiff.total_additions}</span>
                    <span className="text-rose-400">-{fileDiff.total_deletions}</span>
                  </div>
                )}
              </div>

              {selectedFile && fileDiff && fileDiff.hunks.length > 0 && (
                <div className="flex items-center bg-shark-900 rounded-lg border border-shark-750 p-0.5 flex-shrink-0">
                  <button
                    onClick={() => setDiffViewMode("unified")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      diffViewMode === "unified"
                        ? "bg-sky-500/20 text-sky-300 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Inline
                  </button>
                  <button
                    onClick={() => setDiffViewMode("split")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      diffViewMode === "split"
                        ? "bg-sky-500/20 text-sky-300 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Split
                  </button>
                </div>
              )}
            </div>

            {/* Diff Content Area */}
            <div className="flex-1 overflow-auto p-3 min-h-0">
              {isLoadingDiff ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
                  <span>Computing file diff for stash...</span>
                </div>
              ) : !selectedFile ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 italic text-xs gap-2">
                  <FileCode className="w-8 h-8 opacity-40 text-slate-500" />
                  <span>Select any stashed file on the left to view changes</span>
                </div>
              ) : !fileDiff || fileDiff.hunks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs gap-2 p-6 text-center">
                  <FileText className="w-8 h-8 text-slate-600" />
                  {fileDiff?.is_binary ? (
                    <span className="font-mono">Binary file modified (visual diff not supported)</span>
                  ) : (
                    <span>No differences detected for this file in stash.</span>
                  )}
                </div>
              ) : (
                /* Hunk List Rendering */
                <div className="space-y-3 font-mono text-[11px]">
                  {fileDiff.hunks.map((hunk, hIdx) => (
                    <div
                      key={hIdx}
                      className="border border-shark-800 rounded-lg bg-shark-900/60 overflow-hidden shadow-sm"
                    >
                      {/* Hunk Header */}
                      <div className="px-3 py-1 bg-shark-900/90 border-b border-shark-800 text-sky-400/90 font-medium text-[10px] select-none">
                        {hunk.header}
                      </div>

                      {/* Hunk Lines */}
                      <div className="overflow-x-auto divide-y divide-shark-900/30">
                        {hunk.lines.map((line, lIdx) => {
                          const isAdd = line.origin === "+";
                          const isDel = line.origin === "-";

                          return (
                            <div
                              key={lIdx}
                              className={`flex items-center leading-5 hover:bg-white/[0.02] ${
                                isAdd
                                  ? "bg-emerald-950/30 text-emerald-300"
                                  : isDel
                                  ? "bg-rose-950/30 text-rose-300"
                                  : "text-slate-300"
                              }`}
                            >
                              <span className="w-10 text-right pr-2 text-slate-600 select-none text-[10px] border-r border-shark-800/40">
                                {line.old_lineno ?? ""}
                              </span>
                              <span className="w-10 text-right pr-2 text-slate-600 select-none text-[10px] border-r border-shark-800/40">
                                {line.new_lineno ?? ""}
                              </span>
                              <span className="w-5 text-center select-none font-bold text-xs flex-shrink-0">
                                {line.origin === "+" || line.origin === "-" ? line.origin : " "}
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
