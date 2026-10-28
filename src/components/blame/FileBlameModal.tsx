import React, { useState, useEffect, useMemo, useRef } from "react";
import { useBlameStore } from "@/store/useBlameStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import {
  getFileBlameIpc,
  getFileHistoryIpc,
  getCommitFileDiffIpc,
} from "@/lib/ipc";
import {
  FileBlameData,
  FileHistoryItem,
  FileDiff,
  BlameHunkItem,
} from "@/types/diff";
import { formatRelativeTime, formatShortHash } from "@/lib/utils";
import {
  X,
  History,
  FileCode,
  GitCommit,
  User,
  Calendar,
  Copy,
  Check,
  Search,
  RotateCw,
  AlignJustify,
  Split,
  AlertCircle,
  FileText,
} from "lucide-react";

export const FileBlameModal: React.FC = () => {
  const { isOpen, repoId, filePath, tabId, activeView, closeBlame, setActiveView } =
    useBlameStore();
  const { setActiveView: setWorkspaceActiveView, updateTab } = useWorkspaceStore();

  // Blame data state
  const [blameData, setBlameData] = useState<FileBlameData | null>(null);
  const [isBlameLoading, setIsBlameLoading] = useState(false);
  const [blameError, setBlameError] = useState<string | null>(null);

  // History data state
  const [historyItems, setHistoryItems] = useState<FileHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);

  // Commit diff state for selected history item
  const [selectedCommitDiff, setSelectedCommitDiff] = useState<FileDiff | null>(null);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState<"unified" | "split">("unified");

  // Filter/search queries
  const [searchQuery, setSearchQuery] = useState("");

  // Hovered commit in blame view to highlight related lines
  const [hoveredCommitId, setHoveredCommitId] = useState<string | null>(null);

  // Popover state for blame commit details
  const [activePopoverCommit, setActivePopoverCommit] = useState<{
    hunk: BlameHunkItem;
    x: number;
    y: number;
  } | null>(null);

  // Copied indicator
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Blame Data
  const loadBlame = async () => {
    if (!repoId || !filePath) return;
    setIsBlameLoading(true);
    setBlameError(null);
    try {
      const data = await getFileBlameIpc(repoId, filePath);
      setBlameData(data);
    } catch (err: any) {
      setBlameError(err?.message || String(err));
    } finally {
      setIsBlameLoading(false);
    }
  };

  // 2. Fetch File History Data
  const loadHistory = async () => {
    if (!repoId || !filePath) return;
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      const items = await getFileHistoryIpc(repoId, filePath);
      setHistoryItems(items);
      if (items.length > 0 && !selectedCommitHash) {
        setSelectedCommitHash(items[0].commit_hash);
      }
    } catch (err: any) {
      setHistoryError(err?.message || String(err));
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // 3. Load Commit Diff for selected history item
  useEffect(() => {
    if (!repoId || !filePath || !selectedCommitHash || activeView !== "history") return;

    let isMounted = true;
    setIsDiffLoading(true);

    getCommitFileDiffIpc(repoId, selectedCommitHash, filePath)
      .then((diff) => {
        if (isMounted) setSelectedCommitDiff(diff);
      })
      .catch((err) => {
        console.error("Failed to load commit diff:", err);
        if (isMounted) setSelectedCommitDiff(null);
      })
      .finally(() => {
        if (isMounted) setIsDiffLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [repoId, filePath, selectedCommitHash, activeView]);

  // Initial load when modal opens or path/view changes
  useEffect(() => {
    if (!isOpen || !repoId || !filePath) return;

    if (activeView === "blame") {
      loadBlame();
    } else {
      loadHistory();
    }
    setSearchQuery("");
    setActivePopoverCommit(null);
    setHoveredCommitId(null);
  }, [isOpen, repoId, filePath, activeView]);

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        if (activePopoverCommit) {
          setActivePopoverCommit(null);
        } else {
          closeBlame();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activePopoverCommit, closeBlame]);

  // Map each line number (1-based) to its BlameHunkItem
  const lineToHunkMap = useMemo(() => {
    if (!blameData) return new Map<number, BlameHunkItem>();
    const map = new Map<number, BlameHunkItem>();
    for (const hunk of blameData.hunks) {
      for (let i = 0; i < hunk.lines_in_hunk; i++) {
        map.set(hunk.start_line + i, hunk);
      }
    }
    return map;
  }, [blameData]);

  // Filter history items by search query
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return historyItems;
    const q = searchQuery.toLowerCase();
    return historyItems.filter(
      (item) =>
        item.summary.toLowerCase().includes(q) ||
        item.author_name.toLowerCase().includes(q) ||
        item.commit_hash.toLowerCase().includes(q)
    );
  }, [historyItems, searchQuery]);

  // Copy helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSha(text);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  // Jump to commit graph
  const handleJumpToGraph = (commitHash: string) => {
    if (tabId) {
      setWorkspaceActiveView(tabId, "graph");
      updateTab(tabId, { selectedCommitHash: commitHash });
    }
    closeBlame();
  };

  if (!isOpen || !filePath) return null;

  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="relative w-full max-w-6xl h-[90vh] bg-shark-950 border border-shark-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-shark-900 border-b border-shark-800 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 mr-4">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex-shrink-0">
              <FileCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-100 truncate">
                  {fileName}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-shark-800 text-slate-400 font-mono">
                  {filePath}
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>File Inspector</span>
                <span>•</span>
                {activeView === "blame" ? (
                  <span>Line-by-line commit authorship & history</span>
                ) : (
                  <span>Commit timeline & per-commit diffs</span>
                )}
              </div>
            </div>
          </div>

          {/* Center Tabs: Blame vs File History */}
          <div className="flex items-center gap-1 bg-shark-950 p-1 rounded-lg border border-shark-800 text-xs flex-shrink-0">
            <button
              onClick={() => setActiveView("blame")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                activeView === "blame"
                  ? "bg-sky-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Interactive Blame</span>
            </button>
            <button
              onClick={() => setActiveView("history")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                activeView === "history"
                  ? "bg-sky-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>File History</span>
              {historyItems.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeView === "history" ? "bg-sky-700 text-sky-100" : "bg-shark-800 text-slate-400"
                }`}>
                  {historyItems.length}
                </span>
              )}
            </button>
          </div>

          {/* Right Controls: Refresh & Close */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={activeView === "blame" ? loadBlame : loadHistory}
              title="Refresh"
              className="p-1.5 rounded-md hover:bg-shark-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={closeBlame}
              title="Close (Esc)"
              className="p-1.5 rounded-md hover:bg-shark-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Content Area */}
        <div className="flex-1 flex overflow-hidden relative">
          {activeView === "blame" ? (
            /* ============================================================ */
            /* 1. INTERACTIVE BLAME VIEW                                    */
            /* ============================================================ */
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-shark-950">
              {/* Blame Toolbar */}
              <div className="flex items-center justify-between px-4 py-2 bg-shark-900/60 border-b border-shark-800 text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="font-mono text-[11px] text-slate-300">
                    {blameData?.lines?.length ?? 0} lines
                  </span>
                  <span>•</span>
                  <span>{blameData?.hunks?.length ?? 0} commits involved</span>
                  {hoveredCommitId && (
                    <span className="text-sky-400 text-[11px] font-mono ml-2">
                      Highlighting commit {formatShortHash(hoveredCommitId)}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter code or commits..."
                    className="w-56 pl-8 pr-3 py-1 bg-shark-950 border border-shark-800 rounded-md text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Blame Content Body */}
              <div className="flex-1 overflow-auto font-mono text-xs select-text">
                {isBlameLoading ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                    <RotateCw className="w-6 h-6 animate-spin text-sky-400" />
                    <span>Analyzing git blame hunks...</span>
                  </div>
                ) : blameError ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-rose-400 p-8 text-center">
                    <AlertCircle className="w-8 h-8" />
                    <span className="font-semibold">Failed to load blame:</span>
                    <span className="text-xs text-slate-400 max-w-md">{blameError}</span>
                  </div>
                ) : blameData?.is_binary ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                    <AlertCircle className="w-8 h-8 text-amber-400" />
                    <span className="font-semibold text-slate-200">Binary File Detected</span>
                    <span className="text-xs text-slate-500">
                      Line blame is not supported for binary file assets.
                    </span>
                  </div>
                ) : !blameData || blameData.lines.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    <span>File is empty or untracked in git.</span>
                  </div>
                ) : (
                  <div className="min-w-full inline-block">
                    {blameData.lines.map((lineContent, idx) => {
                      const lineNo = idx + 1;
                      const hunk = lineToHunkMap.get(lineNo);
                      const isFirstLineOfHunk = hunk && hunk.start_line === lineNo;
                      const isCommitHovered =
                        hoveredCommitId && hunk && hunk.commit_id === hoveredCommitId;

                      const matchesSearch =
                        searchQuery &&
                        (lineContent.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          hunk?.commit_summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          hunk?.author_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          hunk?.commit_id.toLowerCase().includes(searchQuery.toLowerCase()));

                      return (
                        <div
                          key={lineNo}
                          onMouseEnter={() => hunk && setHoveredCommitId(hunk.commit_id)}
                          onMouseLeave={() => setHoveredCommitId(null)}
                          className={`flex items-stretch border-b border-shark-900/40 transition-colors group min-w-full w-fit ${
                            isCommitHovered
                              ? "bg-sky-500/10"
                              : isFirstLineOfHunk
                              ? "border-t border-t-shark-800/80 bg-shark-900/10"
                              : "hover:bg-shark-900/30"
                          } ${matchesSearch ? "bg-amber-500/10" : ""}`}
                        >
                          {/* Blame Gutter Column (Commit info) */}
                          <div
                            onClick={(e) => {
                              if (hunk) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setActivePopoverCommit({
                                  hunk,
                                  x: rect.right + 8,
                                  y: Math.min(rect.top, window.innerHeight - 280),
                                });
                              }
                            }}
                            className={`w-72 flex-shrink-0 px-2.5 py-0.5 flex items-center gap-2 border-r border-shark-800 text-[11px] select-none cursor-pointer ${
                              isFirstLineOfHunk ? "opacity-100" : "opacity-0 group-hover:opacity-40"
                            }`}
                            title={
                              hunk
                                ? `${hunk.commit_summary}\n${hunk.author_name} • ${formatRelativeTime(
                                    hunk.timestamp
                                  )}\n${hunk.commit_id}`
                                : ""
                            }
                          >
                            {hunk ? (
                              <>
                                <span className="font-mono text-sky-400 hover:underline">
                                  {formatShortHash(hunk.commit_id)}
                                </span>
                                <span className="text-slate-300 truncate max-w-[100px]" title={hunk.author_name}>
                                  {hunk.author_name}
                                </span>
                                <span className="text-slate-500 ml-auto flex-shrink-0 text-[10px]">
                                  {formatRelativeTime(hunk.timestamp)}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-600">-------</span>
                            )}
                          </div>

                          {/* Line Number Column */}
                          <div className="w-12 flex-shrink-0 px-2 py-0.5 text-right select-none text-[11px] text-slate-500 border-r border-shark-800/60">
                            {lineNo}
                          </div>

                          {/* Code Line Content */}
                          <div className="flex-1 px-3 py-0.5 whitespace-pre text-slate-200 text-[12px] leading-relaxed">
                            {lineContent || " "}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* 2. FILE HISTORY (TIMELINE & DIFF)                            */
            /* ============================================================ */
            <div className="flex-1 flex overflow-hidden">
              {/* Left Column: Chronological Commits List */}
              <div className="w-80 border-r border-shark-800 flex flex-col bg-shark-950 flex-shrink-0">
                {/* Search Bar */}
                <div className="p-3 border-b border-shark-800 bg-shark-900/40">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search commit messages or authors..."
                      className="w-full pl-8 pr-3 py-1.5 bg-shark-950 border border-shark-800 rounded-md text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Commit List */}
                <div className="flex-1 overflow-y-auto divide-y divide-shark-900">
                  {isHistoryLoading ? (
                    <div className="p-6 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
                      <RotateCw className="w-5 h-5 animate-spin text-sky-400" />
                      <span>Loading commit log...</span>
                    </div>
                  ) : historyError ? (
                    <div className="p-4 text-xs text-rose-400 text-center">{historyError}</div>
                  ) : filteredHistory.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No commits found matching filter.
                    </div>
                  ) : (
                    filteredHistory.map((item) => {
                      const isSelected = selectedCommitHash === item.commit_hash;
                      return (
                        <div
                          key={item.commit_hash}
                          onClick={() => setSelectedCommitHash(item.commit_hash)}
                          className={`p-3 text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-sky-500/15 border-l-2 border-sky-400"
                              : "hover:bg-shark-900/50 border-l-2 border-transparent"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                            <span className="font-semibold text-slate-300 truncate max-w-[130px]">
                              {item.author_name}
                            </span>
                            <span className="text-slate-500">
                              {formatRelativeTime(item.timestamp)}
                            </span>
                          </div>

                          <div className="font-medium text-slate-200 line-clamp-2 leading-tight mb-2">
                            {item.summary}
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/60">
                              {formatShortHash(item.commit_hash)}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {item.additions > 0 && (
                                <span className="text-emerald-400 font-semibold">
                                  +{item.additions}
                                </span>
                              )}
                              {item.deletions > 0 && (
                                <span className="text-rose-400 font-semibold">
                                  -{item.deletions}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Selected Commit Details & Diff */}
              <div className="flex-1 flex flex-col bg-shark-950 overflow-hidden">
                {selectedCommitHash ? (
                  <>
                    {/* Header for selected commit */}
                    {(() => {
                      const commit = historyItems.find(
                        (i) => i.commit_hash === selectedCommitHash
                      );
                      return (
                        <div className="px-5 py-3 bg-shark-900/60 border-b border-shark-800 flex items-center justify-between flex-shrink-0">
                          <div className="min-w-0 mr-4">
                            <h4 className="text-sm font-semibold text-slate-100 truncate">
                              {commit?.summary || selectedCommitHash}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                              <span className="text-sky-400">{formatShortHash(selectedCommitHash)}</span>
                              <span>•</span>
                              <span>{commit?.author_name}</span>
                              <span>•</span>
                              <span>
                                {commit?.timestamp
                                  ? new Date(commit.timestamp * 1000).toLocaleString()
                                  : ""}
                              </span>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Unified vs Split Toggle */}
                            <div className="flex items-center bg-shark-950 p-0.5 rounded-lg border border-shark-800 text-xs">
                              <button
                                onClick={() => setDiffViewMode("unified")}
                                className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                                  diffViewMode === "unified"
                                    ? "bg-shark-800 text-sky-300 font-medium"
                                    : "text-slate-400 hover:text-slate-200"
                                }`}
                                title="Unified Diff"
                              >
                                <AlignJustify className="w-3.5 h-3.5" />
                                <span>Unified</span>
                              </button>
                              <button
                                onClick={() => setDiffViewMode("split")}
                                className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                                  diffViewMode === "split"
                                    ? "bg-shark-800 text-sky-300 font-medium"
                                    : "text-slate-400 hover:text-slate-200"
                                }`}
                                title="Split Diff"
                              >
                                <Split className="w-3.5 h-3.5" />
                                <span>Split</span>
                              </button>
                            </div>

                            <button
                              onClick={() => handleCopy(selectedCommitHash)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-shark-850 hover:bg-shark-800 text-slate-300 text-xs border border-shark-750 transition-colors"
                              title="Copy Commit SHA"
                            >
                              {copiedSha === selectedCommitHash ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy SHA</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => handleJumpToGraph(selectedCommitHash)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium text-xs shadow-sm transition-colors"
                              title="Focus commit in Graph view"
                            >
                              <GitCommit className="w-3.5 h-3.5" />
                              <span>View in Graph</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Diff Body */}
                    <div className="flex-1 overflow-auto p-4 font-mono text-xs select-text">
                      {isDiffLoading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500">
                          <RotateCw className="w-5 h-5 animate-spin text-sky-400" />
                          <span>Generating historical diff...</span>
                        </div>
                      ) : !selectedCommitDiff || selectedCommitDiff.hunks.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500">
                          <span>No textual changes for this file in this commit.</span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {selectedCommitDiff.hunks.map((hunk, hunkIdx) => (
                            <div
                              key={hunkIdx}
                              className="border border-shark-800 rounded-lg overflow-hidden bg-shark-900/20"
                            >
                              {/* Hunk Header */}
                              <div className="px-3 py-1.5 bg-shark-900/80 border-b border-shark-800 text-[11px] text-sky-300 font-mono">
                                {hunk.header}
                              </div>

                              {diffViewMode === "unified" ? (
                                /* Unified Hunk View */
                                <div className="overflow-x-auto">
                                  <div className="divide-y divide-shark-900/40 min-w-full w-fit">
                                    {hunk.lines.map((line, lineIdx) => {
                                      const isAdd = line.origin === "+";
                                      const isDel = line.origin === "-";

                                      return (
                                        <div
                                          key={lineIdx}
                                          className={`flex items-start select-text min-w-full w-fit ${
                                            isAdd
                                              ? "bg-emerald-950/30 text-emerald-300 border-l-2 border-emerald-500"
                                              : isDel
                                              ? "bg-rose-950/35 text-rose-300 border-l-2 border-rose-500"
                                              : "text-slate-300 border-l-2 border-transparent"
                                          }`}
                                        >
                                          <span className="w-10 px-2 py-0.5 text-right text-slate-500 select-none text-[10.5px] flex-shrink-0">
                                            {line.old_lineno ?? ""}
                                          </span>
                                          <span className="w-10 px-2 py-0.5 text-right text-slate-500 select-none text-[10.5px] border-r border-shark-800/60 flex-shrink-0">
                                            {line.new_lineno ?? ""}
                                          </span>
                                          <span className="w-6 py-0.5 text-center font-bold select-none text-slate-500 flex-shrink-0">
                                            {line.origin === " " ? "" : line.origin}
                                          </span>
                                          <span className="flex-1 py-0.5 pr-4 whitespace-pre">
                                            {line.content || " "}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                /* Split Hunk View */
                                <div className="overflow-x-auto">
                                  <table className="w-full min-w-full border-collapse">
                                    <colgroup>
                                      <col className="w-1/2" />
                                      <col className="w-1/2" />
                                    </colgroup>
                                    <tbody className="divide-y divide-shark-900/40">
                                      {hunk.lines.map((line, lineIdx) => {
                                        const isAdd = line.origin === "+";
                                        const isDel = line.origin === "-";

                                        return (
                                          <tr key={lineIdx} className="select-text">
                                            {/* Left column (Old) */}
                                            <td
                                              className={`p-0 align-top border-r border-shark-800 ${
                                                isDel
                                                  ? "bg-rose-950/35 text-rose-300"
                                                  : isAdd
                                                  ? "bg-shark-950/50 text-transparent select-none"
                                                  : "text-slate-300"
                                              }`}
                                            >
                                              <div className="flex items-start">
                                                <span className="w-10 px-2 py-0.5 text-right text-slate-500 select-none text-[10.5px] border-r border-shark-800/60 flex-shrink-0">
                                                  {line.old_lineno ?? ""}
                                                </span>
                                                <span className="w-5 py-0.5 text-center font-bold select-none text-rose-400 flex-shrink-0">
                                                  {isDel ? "-" : ""}
                                                </span>
                                                <span className="flex-1 py-0.5 pr-4 whitespace-pre">
                                                  {!isAdd ? line.content || " " : " "}
                                                </span>
                                              </div>
                                            </td>

                                            {/* Right column (New) */}
                                            <td
                                              className={`p-0 align-top ${
                                                isAdd
                                                  ? "bg-emerald-950/30 text-emerald-300"
                                                  : isDel
                                                  ? "bg-shark-950/50 text-transparent select-none"
                                                  : "text-slate-300"
                                              }`}
                                            >
                                              <div className="flex items-start">
                                                <span className="w-10 px-2 py-0.5 text-right text-slate-500 select-none text-[10.5px] border-r border-shark-800/60 flex-shrink-0">
                                                  {line.new_lineno ?? ""}
                                                </span>
                                                <span className="w-5 py-0.5 text-center font-bold select-none text-emerald-400 flex-shrink-0">
                                                  {isAdd ? "+" : ""}
                                                </span>
                                                <span className="flex-1 py-0.5 pr-4 whitespace-pre">
                                                  {!isDel ? line.content || " " : " "}
                                                </span>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    <History className="w-8 h-8 mb-2 opacity-50" />
                    <span>Select a commit from the timeline to review diff changes.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Interactive Commit Popover for Blame */}
          {activePopoverCommit && (
            <div
              className="fixed z-[60] w-80 bg-shark-900 border border-shark-750 rounded-xl shadow-2xl p-4 text-xs animate-in fade-in zoom-in-95 duration-100"
              style={{
                left: `${Math.min(activePopoverCommit.x, window.innerWidth - 340)}px`,
                top: `${activePopoverCommit.y}px`,
              }}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-shark-800">
                <span className="font-mono text-sky-400 font-semibold">
                  {formatShortHash(activePopoverCommit.hunk.commit_id)}
                </span>
                <button
                  onClick={() => setActivePopoverCommit(null)}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2 mb-3">
                <div className="font-medium text-slate-100 leading-tight">
                  {activePopoverCommit.hunk.commit_summary}
                </div>

                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <User className="w-3 h-3 text-slate-500" />
                  <span className="text-slate-300">{activePopoverCommit.hunk.author_name}</span>
                  <span className="text-slate-500">({activePopoverCommit.hunk.author_email})</span>
                </div>

                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>
                    {new Date(activePopoverCommit.hunk.timestamp * 1000).toLocaleString()} (
                    {formatRelativeTime(activePopoverCommit.hunk.timestamp)})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-shark-800">
                <button
                  onClick={() => handleCopy(activePopoverCommit.hunk.commit_id)}
                  className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded bg-shark-800 hover:bg-shark-750 text-slate-200 text-xs transition-colors"
                >
                  {copiedSha === activePopoverCommit.hunk.commit_id ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy SHA</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    handleJumpToGraph(activePopoverCommit.hunk.commit_id);
                    setActivePopoverCommit(null);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium text-xs transition-colors"
                >
                  <GitCommit className="w-3 h-3" />
                  <span>View in Graph</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
