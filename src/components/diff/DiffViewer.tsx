import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FileDiff, DiffHunk } from "@/types";
import { useBlameStore } from "@/store/useBlameStore";
import {
  Split,
  AlignJustify,
  Plus,
  Minus,
  FileCode,
  AlertCircle,
  RotateCw,
  FileText,
  History,
  Trash2,
  CheckSquare,
  Square,
  X,
} from "lucide-react";

interface DiffViewerProps {
  diff: FileDiff | null;
  filePath: string | null;
  isStaged: boolean;
  onStageHunk: (patch: string) => void;
  onUnstageHunk?: (hunk: DiffHunk) => void;
  onDiscardHunk?: (hunk: DiffHunk) => void;
  onStageLines?: (hunk: DiffHunk, lineIndices: number[]) => void;
  onUnstageLines?: (hunk: DiffHunk, lineIndices: number[]) => void;
  onDiscardLines?: (hunk: DiffHunk, lineIndices: number[]) => void;
  onToggleStageFile: () => void;
  isLoading?: boolean;
  isRefreshing?: boolean;
  repoId?: string | null;
  tabId?: string | null;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diff,
  filePath,
  isStaged,
  onStageHunk,
  onUnstageHunk,
  onDiscardHunk,
  onStageLines,
  onUnstageLines,
  onDiscardLines,
  onToggleStageFile,
  isLoading = false,
  isRefreshing = false,
  repoId,
  tabId,
}) => {
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified");

  // Map of hunkIdx -> Set of selected lineIdx within hunk.lines
  const [selectedLines, setSelectedLines] = useState<Map<number, Set<number>>>(new Map());
  const [lastSelected, setLastSelected] = useState<{ hunkIdx: number; lineIdx: number } | null>(null);

  // Clear selection whenever file path or staging state changes
  useEffect(() => {
    setSelectedLines(new Map());
    setLastSelected(null);
  }, [filePath, isStaged]);

  // Total count of selected lines across all hunks
  const totalSelectedCount = useMemo(() => {
    let count = 0;
    selectedLines.forEach((set) => {
      count += set.size;
    });
    return count;
  }, [selectedLines]);

  // Global Escape shortcut to deselect all lines
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && totalSelectedCount > 0) {
        setSelectedLines(new Map());
        setLastSelected(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalSelectedCount]);

  // Toggle selection for an individual line
  const handleToggleLine = useCallback(
    (hunkIdx: number, lineIdx: number, isShift: boolean) => {
      setSelectedLines((prev) => {
        const next = new Map(prev);
        const currentSet = new Set(next.get(hunkIdx) || []);

        if (isShift && lastSelected && lastSelected.hunkIdx === hunkIdx) {
          const start = Math.min(lastSelected.lineIdx, lineIdx);
          const end = Math.max(lastSelected.lineIdx, lineIdx);
          const hunk = diff?.hunks[hunkIdx];
          if (hunk) {
            for (let i = start; i <= end; i++) {
              if (hunk.lines[i].origin === "+" || hunk.lines[i].origin === "-") {
                currentSet.add(i);
              }
            }
          }
        } else {
          if (currentSet.has(lineIdx)) {
            currentSet.delete(lineIdx);
          } else {
            currentSet.add(lineIdx);
          }
        }

        if (currentSet.size === 0) {
          next.delete(hunkIdx);
        } else {
          next.set(hunkIdx, currentSet);
        }
        return next;
      });

      setLastSelected({ hunkIdx, lineIdx });
    },
    [diff, lastSelected]
  );

  // Select / Deselect all modified lines in a hunk
  const handleToggleHunkSelection = (hunkIdx: number, hunk: DiffHunk) => {
    setSelectedLines((prev) => {
      const next = new Map(prev);
      const currentSet = next.get(hunkIdx);
      const modifiableIndices = hunk.lines
        .map((l, i) => (l.origin === "+" || l.origin === "-" ? i : -1))
        .filter((i) => i !== -1);

      if (currentSet && currentSet.size === modifiableIndices.length) {
        // Deselect all
        next.delete(hunkIdx);
      } else {
        // Select all modifiable lines in hunk
        next.set(hunkIdx, new Set(modifiableIndices));
      }
      return next;
    });
  };

  // Stage single line
  const handleStageSingleLine = (hunk: DiffHunk, lineIdx: number) => {
    if (onStageLines) {
      onStageLines(hunk, [lineIdx]);
    }
  };

  // Unstage single line
  const handleUnstageSingleLine = (hunk: DiffHunk, lineIdx: number) => {
    if (onUnstageLines) {
      onUnstageLines(hunk, [lineIdx]);
    }
  };

  // Discard single line
  const handleDiscardSingleLine = (hunk: DiffHunk, lineIdx: number) => {
    if (onDiscardLines) {
      onDiscardLines(hunk, [lineIdx]);
    }
  };

  // Stage selected lines for a specific hunk
  const handleStageHunkSelected = (hunkIdx: number, hunk: DiffHunk) => {
    const indices = Array.from(selectedLines.get(hunkIdx) || []).sort((a, b) => a - b);
    if (indices.length > 0 && onStageLines) {
      onStageLines(hunk, indices);
      setSelectedLines((prev) => {
        const next = new Map(prev);
        next.delete(hunkIdx);
        return next;
      });
    }
  };

  // Unstage selected lines for a specific hunk
  const handleUnstageHunkSelected = (hunkIdx: number, hunk: DiffHunk) => {
    const indices = Array.from(selectedLines.get(hunkIdx) || []).sort((a, b) => a - b);
    if (indices.length > 0 && onUnstageLines) {
      onUnstageLines(hunk, indices);
      setSelectedLines((prev) => {
        const next = new Map(prev);
        next.delete(hunkIdx);
        return next;
      });
    }
  };

  // Discard selected lines for a specific hunk
  const handleDiscardHunkSelected = (hunkIdx: number, hunk: DiffHunk) => {
    const indices = Array.from(selectedLines.get(hunkIdx) || []).sort((a, b) => a - b);
    if (indices.length > 0 && onDiscardLines) {
      onDiscardLines(hunk, indices);
      setSelectedLines((prev) => {
        const next = new Map(prev);
        next.delete(hunkIdx);
        return next;
      });
    }
  };

  // Stage all selected lines across all hunks
  const handleStageAllSelected = async () => {
    if (!diff || !onStageLines) return;
    for (const [hunkIdx, lineSet] of selectedLines.entries()) {
      const hunk = diff.hunks[hunkIdx];
      const indices = Array.from(lineSet).sort((a, b) => a - b);
      if (hunk && indices.length > 0) {
        await onStageLines(hunk, indices);
      }
    }
    setSelectedLines(new Map());
  };

  // Unstage all selected lines across all hunks
  const handleUnstageAllSelected = async () => {
    if (!diff || !onUnstageLines) return;
    for (const [hunkIdx, lineSet] of selectedLines.entries()) {
      const hunk = diff.hunks[hunkIdx];
      const indices = Array.from(lineSet).sort((a, b) => a - b);
      if (hunk && indices.length > 0) {
        await onUnstageLines(hunk, indices);
      }
    }
    setSelectedLines(new Map());
  };

  // Discard all selected lines across all hunks
  const handleDiscardAllSelected = async () => {
    if (!diff || !onDiscardLines) return;
    for (const [hunkIdx, lineSet] of selectedLines.entries()) {
      const hunk = diff.hunks[hunkIdx];
      const indices = Array.from(lineSet).sort((a, b) => a - b);
      if (hunk && indices.length > 0) {
        await onDiscardLines(hunk, indices);
      }
    }
    setSelectedLines(new Map());
  };

  if (isLoading && !diff) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-shark-950 text-slate-400 gap-2">
        <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">Computing diff hunks with git2...</span>
      </div>
    );
  }

  if (!filePath || !diff) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-shark-950 text-slate-400 p-8 select-none">
        <div className="max-w-sm text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mx-auto text-sky-400">
            <FileCode className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">
            No File Selected
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Select a modified or staged file from the left drawer to review line-by-line diff hunks, stage individual lines or patches, or discard changes.
          </p>
        </div>
      </div>
    );
  }

  if (diff.is_binary) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-shark-950 text-slate-400 p-8">
        <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
        <div className="text-sm font-semibold text-slate-200">Binary File Detected</div>
        <div className="text-xs text-slate-500 mt-1">
          Binary file changes cannot be displayed in text diff view.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-shark-950 h-full overflow-hidden select-none relative">
      {/* Diff Toolbar Header */}
      <div className="flex items-center justify-between px-4 h-11 bg-shark-900 border-b border-shark-800 flex-shrink-0">
        {/* Left: File Path & Diff stats */}
        <div className="flex items-center gap-2.5 truncate mr-4">
          <span className="text-xs font-mono font-semibold text-slate-100 truncate">
            {filePath}
          </span>

          {diff.is_new && (
            <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 font-semibold border border-emerald-800/60 text-[10px]">
              New File
            </span>
          )}
          {diff.is_deleted && (
            <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 font-semibold border border-rose-800/60 text-[10px]">
              Deleted File
            </span>
          )}

          <div className="flex items-center gap-1.5 text-xs font-mono">
            {diff.total_additions > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 font-semibold border border-emerald-800/60">
                +{diff.total_additions}
              </span>
            )}
            {diff.total_deletions > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 font-semibold border border-rose-800/60">
                -{diff.total_deletions}
              </span>
            )}
          </div>

          {(isRefreshing || isLoading) && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-950/80 border border-sky-800/50 text-[10px] text-sky-400 font-mono animate-pulse">
              <RotateCw className="w-2.5 h-2.5 animate-spin" />
              <span>Updating</span>
            </span>
          )}
        </div>

        {/* Right: Blame/History, View Mode Toggle & Primary Stage/Unstage Action */}
        <div className="flex items-center gap-2">
          {/* File Blame & History Inspector Trigger */}
          {repoId && filePath && (
            <div className="flex items-center bg-shark-950 p-0.5 rounded-lg border border-shark-800 text-xs">
              <button
                onClick={() =>
                  useBlameStore
                    .getState()
                    .openBlame(repoId, filePath, tabId || undefined, "blame")
                }
                className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-slate-400 hover:text-sky-300 hover:bg-shark-800/60 transition-colors"
                title="Inspect line-by-line blame"
              >
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span>Blame</span>
              </button>
              <button
                onClick={() =>
                  useBlameStore
                    .getState()
                    .openBlame(repoId, filePath, tabId || undefined, "history")
                }
                className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-slate-400 hover:text-indigo-300 hover:bg-shark-800/60 transition-colors"
                title="Inspect file history and commits"
              >
                <History className="w-3.5 h-3.5 text-indigo-400" />
                <span>History</span>
              </button>
            </div>
          )}

          {/* Unified vs Split Toggle */}
          <div className="flex items-center bg-shark-950 p-0.5 rounded-lg border border-shark-800 text-xs">
            <button
              onClick={() => setViewMode("unified")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
                viewMode === "unified"
                  ? "bg-shark-800 text-sky-300 font-medium shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Unified Diff View"
            >
              <AlignJustify className="w-3.5 h-3.5" />
              <span>Unified</span>
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
                viewMode === "split"
                  ? "bg-shark-800 text-sky-300 font-medium shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Side-by-Side Split Diff View"
            >
              <Split className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
          </div>

          {/* Quick Stage / Unstage Button */}
          <button
            onClick={onToggleStageFile}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors border shadow-sm ${
              isStaged
                ? "bg-shark-850 hover:bg-shark-800 text-slate-200 border-shark-750"
                : "bg-sky-500 hover:bg-sky-400 text-slate-950 border-sky-400"
            }`}
          >
            {isStaged ? (
              <>
                <Minus className="w-3 h-3" />
                <span>Unstage File</span>
              </>
            ) : (
              <>
                <Plus className="w-3 h-3" />
                <span>Stage File</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Diff Hunks Container */}
      <div className="flex-1 overflow-auto font-mono text-[11.5px] leading-relaxed p-2 space-y-4">
        {diff.hunks.length === 0 ? (
          <div className="p-8 text-center text-slate-500 italic">
            {diff.is_new
              ? "New file is empty (0 lines)"
              : diff.is_deleted
              ? "Deleted file was empty (0 lines)"
              : "File contents are identical (no changes)"}
          </div>
        ) : (
          diff.hunks.map((hunk, hunkIdx) => {
            const hunkSelectedLines = selectedLines.get(hunkIdx) || new Set<number>();
            const modifiableLinesCount = hunk.lines.filter(
              (l) => l.origin === "+" || l.origin === "-"
            ).length;
            const isAllHunkSelected =
              modifiableLinesCount > 0 && hunkSelectedLines.size === modifiableLinesCount;

            return (
              <div
                key={hunkIdx}
                className="rounded-lg border border-shark-800/90 overflow-hidden bg-shark-900/40 shadow-sm"
              >
                {/* Hunk Header with Line Selection & Hunk Actions */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-shark-850 border-b border-shark-800 text-slate-400 select-none">
                  <div className="flex items-center gap-2">
                    {/* Hunk select-all checkbox */}
                    {modifiableLinesCount > 0 && (
                      <button
                        onClick={() => handleToggleHunkSelection(hunkIdx, hunk)}
                        className="text-slate-400 hover:text-sky-300 transition-colors mr-1"
                        title={isAllHunkSelected ? "Deselect Hunk Lines" : "Select All Lines in Hunk"}
                      >
                        {isAllHunkSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    <span className="text-[11px] font-bold text-sky-400">
                      {hunk.header}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Hunk {hunkIdx + 1} of {diff.hunks.length}
                    </span>

                    {hunkSelectedLines.size > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-950 text-sky-300 border border-sky-800/80 font-sans">
                        {hunkSelectedLines.size} line{hunkSelectedLines.size > 1 ? "s" : ""} selected
                      </span>
                    )}
                  </div>

                  {/* Actions for this hunk */}
                  <div className="flex items-center gap-1.5">
                    {/* If lines are selected in this hunk: Stage/Discard Selected */}
                    {hunkSelectedLines.size > 0 ? (
                      <>
                        {!isStaged ? (
                          <>
                            {onDiscardLines && (
                              <button
                                onClick={() => handleDiscardHunkSelected(hunkIdx, hunk)}
                                className="px-2 py-0.5 rounded text-[10px] bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition-colors"
                                title="Discard selected lines in this hunk"
                              >
                                Discard Selected ({hunkSelectedLines.size})
                              </button>
                            )}
                            <button
                              onClick={() => handleStageHunkSelected(hunkIdx, hunk)}
                              className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold transition-colors shadow-sm"
                              title="Stage selected lines in this hunk"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>Stage Selected ({hunkSelectedLines.size})</span>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleUnstageHunkSelected(hunkIdx, hunk)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-shark-750 hover:bg-shark-700 text-slate-200 border border-shark-650 transition-colors"
                            title="Unstage selected lines in this hunk"
                          >
                            <Minus className="w-2.5 h-2.5" />
                            <span>Unstage Selected ({hunkSelectedLines.size})</span>
                          </button>
                        )}
                      </>
                    ) : (
                      /* Whole Hunk Actions */
                      <>
                        {!isStaged ? (
                          <>
                            {onDiscardHunk && (
                              <button
                                onClick={() => onDiscardHunk(hunk)}
                                className="px-2 py-0.5 rounded text-[10px] bg-rose-950/50 hover:bg-rose-900 text-rose-300 border border-rose-800/40 transition-colors"
                                title="Discard this hunk from working tree"
                              >
                                Discard Hunk
                              </button>
                            )}
                            <button
                              onClick={() => onStageHunk(hunk.patch)}
                              className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold transition-colors shadow-sm"
                              title="Stage only this hunk to index"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>Stage Hunk</span>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => onUnstageHunk ? onUnstageHunk(hunk) : onStageHunk(hunk.patch)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-shark-750 hover:bg-shark-700 text-slate-200 border border-shark-700 transition-colors"
                            title="Unstage this hunk"
                          >
                            <Minus className="w-2.5 h-2.5" />
                            <span>Unstage Hunk</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Hunk Lines Rendering */}
                {viewMode === "unified" ? (
                  /* Unified View with Line-Level Staging */
                  <div className="divide-y divide-shark-900/30">
                    {hunk.lines.map((line, lineIdx) => {
                      const isAdd = line.origin === "+";
                      const isDel = line.origin === "-";
                      const isModifiable = isAdd || isDel;
                      const isLineSelected = hunkSelectedLines.has(lineIdx);

                      return (
                        <div
                          key={lineIdx}
                          className={`flex items-start select-text group/line transition-colors ${
                            isLineSelected
                              ? "bg-sky-500/20 text-slate-100 border-l-4 border-sky-400"
                              : isAdd
                              ? "bg-emerald-950/30 text-emerald-300 border-l-2 border-emerald-500 hover:bg-emerald-950/50"
                              : isDel
                              ? "bg-rose-950/35 text-rose-300 border-l-2 border-rose-500 hover:bg-rose-950/50"
                              : "text-slate-300 border-l-2 border-transparent hover:bg-shark-900/30"
                          }`}
                        >
                          {/* Line action gutter (checkbox + quick action) */}
                          <div className="w-12 px-1 py-0.5 flex items-center justify-center gap-1 select-none flex-shrink-0">
                            {isModifiable ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleLine(hunkIdx, lineIdx, e.shiftKey);
                                  }}
                                  className={`p-0.5 rounded text-slate-400 hover:text-sky-300 transition-opacity ${
                                    isLineSelected
                                      ? "opacity-100 text-sky-400"
                                      : "opacity-0 group-hover/line:opacity-100"
                                  }`}
                                  title="Select line for batch action (Shift+Click for range)"
                                >
                                  {isLineSelected ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                                  ) : (
                                    <Square className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                {/* Quick Stage/Unstage/Discard action button on hover */}
                                {!isStaged ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStageSingleLine(hunk, lineIdx);
                                    }}
                                    className="p-0.5 rounded opacity-0 group-hover/line:opacity-100 hover:bg-sky-500/20 text-sky-400 transition-opacity"
                                    title="Stage line"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnstageSingleLine(hunk, lineIdx);
                                    }}
                                    className="p-0.5 rounded opacity-0 group-hover/line:opacity-100 hover:bg-rose-500/20 text-rose-400 transition-opacity"
                                    title="Unstage line"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ) : null}
                          </div>

                          {/* Old line number */}
                          <span className="w-10 px-2 py-0.5 text-right text-slate-500 select-none text-[10.5px]">
                            {line.old_lineno ?? ""}
                          </span>
                          {/* New line number */}
                          <span className="w-10 px-2 py-0.5 text-right text-slate-500 select-none text-[10.5px] border-r border-shark-800/60">
                            {line.new_lineno ?? ""}
                          </span>
                          {/* Origin symbol (+ / - / space) */}
                          <span className="w-6 py-0.5 text-center font-bold select-none text-slate-500">
                            {line.origin === " " ? "" : line.origin}
                          </span>
                          {/* Line content text */}
                          <span
                            onClick={(e) => {
                              if (isModifiable && (e.ctrlKey || e.metaKey || e.shiftKey)) {
                                handleToggleLine(hunkIdx, lineIdx, e.shiftKey);
                              }
                            }}
                            className="flex-1 py-0.5 pr-2 whitespace-pre overflow-x-auto"
                          >
                            {line.content || " "}
                          </span>

                          {/* Quick discard icon on right edge of line for unstaged */}
                          {isModifiable && !isStaged && onDiscardLines && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDiscardSingleLine(hunk, lineIdx);
                              }}
                              className="px-2 py-0.5 text-rose-400 opacity-0 group-hover/line:opacity-100 hover:bg-rose-950/60 rounded text-[10px] select-none flex-shrink-0 transition-opacity"
                              title="Discard this line"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Split Side-by-Side View with Line-Level Staging */
                  <div className="divide-y divide-shark-900/40">
                    {hunk.lines.map((line, lineIdx) => {
                      const isAdd = line.origin === "+";
                      const isDel = line.origin === "-";
                      const isLineSelected = hunkSelectedLines.has(lineIdx);

                      return (
                        <div
                          key={lineIdx}
                          className={`grid grid-cols-2 divide-x divide-shark-800 select-text group/line ${
                            isLineSelected ? "bg-sky-500/20 border-l-4 border-sky-400" : ""
                          }`}
                        >
                          {/* Left column (Old / Deletions) */}
                          <div
                            className={`flex items-start ${
                              isDel
                                ? "bg-rose-950/35 text-rose-300"
                                : isAdd
                                ? "bg-shark-950/50 text-transparent select-none"
                                : "text-slate-300"
                            }`}
                          >
                            {/* Checkbox and quick action for deletions */}
                            <div className="w-8 px-1 py-0.5 flex items-center justify-center select-none flex-shrink-0">
                              {isDel && (
                                <button
                                  onClick={() => handleToggleLine(hunkIdx, lineIdx, false)}
                                  className={`p-0.5 rounded text-slate-400 hover:text-sky-300 ${
                                    isLineSelected
                                      ? "opacity-100 text-sky-400"
                                      : "opacity-0 group-hover/line:opacity-100"
                                  }`}
                                  title="Select line"
                                >
                                  {isLineSelected ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                                  ) : (
                                    <Square className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>

                            <span className="w-10 px-2 py-0.5 text-right text-slate-500 select-none text-[10.5px] border-r border-shark-800/60">
                              {line.old_lineno ?? ""}
                            </span>
                            <span className="w-5 py-0.5 text-center font-bold select-none text-rose-400">
                              {isDel ? "-" : ""}
                            </span>
                            <span className="flex-1 py-0.5 pr-2 whitespace-pre overflow-x-auto">
                              {!isAdd ? line.content : ""}
                            </span>

                            {isDel && (
                              <div className="opacity-0 group-hover/line:opacity-100 flex items-center gap-1 pr-2">
                                {!isStaged ? (
                                  <>
                                    <button
                                      onClick={() => handleStageSingleLine(hunk, lineIdx)}
                                      className="p-1 hover:bg-sky-500/20 text-sky-400 rounded"
                                      title="Stage line deletion"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                    </button>
                                    {onDiscardLines && (
                                      <button
                                        onClick={() => handleDiscardSingleLine(hunk, lineIdx)}
                                        className="p-1 hover:bg-rose-950 text-rose-400 rounded"
                                        title="Discard line deletion"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleUnstageSingleLine(hunk, lineIdx)}
                                    className="p-1 hover:bg-rose-950 text-rose-400 rounded"
                                    title="Unstage line deletion"
                                  >
                                    <Minus className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Right column (New / Additions) */}
                          <div
                            className={`flex items-start ${
                              isAdd
                                ? "bg-emerald-950/30 text-emerald-300"
                                : isDel
                                ? "bg-shark-950/50 text-transparent select-none"
                                : "text-slate-300"
                            }`}
                          >
                            {/* Checkbox and quick action for additions */}
                            <div className="w-8 px-1 py-0.5 flex items-center justify-center select-none flex-shrink-0">
                              {isAdd && (
                                <button
                                  onClick={() => handleToggleLine(hunkIdx, lineIdx, false)}
                                  className={`p-0.5 rounded text-slate-400 hover:text-sky-300 ${
                                    isLineSelected
                                      ? "opacity-100 text-sky-400"
                                      : "opacity-0 group-hover/line:opacity-100"
                                  }`}
                                  title="Select line"
                                >
                                  {isLineSelected ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                                  ) : (
                                    <Square className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>

                            <span className="w-10 px-2 py-0.5 text-right text-slate-500 select-none text-[10.5px] border-r border-shark-800/60">
                              {line.new_lineno ?? ""}
                            </span>
                            <span className="w-5 py-0.5 text-center font-bold select-none text-emerald-400">
                              {isAdd ? "+" : ""}
                            </span>
                            <span className="flex-1 py-0.5 pr-2 whitespace-pre overflow-x-auto">
                              {!isDel ? line.content : ""}
                            </span>

                            {isAdd && (
                              <div className="opacity-0 group-hover/line:opacity-100 flex items-center gap-1 pr-2">
                                {!isStaged ? (
                                  <>
                                    <button
                                      onClick={() => handleStageSingleLine(hunk, lineIdx)}
                                      className="p-1 hover:bg-sky-500/20 text-sky-400 rounded"
                                      title="Stage line addition"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                    </button>
                                    {onDiscardLines && (
                                      <button
                                        onClick={() => handleDiscardSingleLine(hunk, lineIdx)}
                                        className="p-1 hover:bg-rose-950 text-rose-400 rounded"
                                        title="Discard line addition"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleUnstageSingleLine(hunk, lineIdx)}
                                    className="p-1 hover:bg-rose-950 text-rose-400 rounded"
                                    title="Unstage line addition"
                                  >
                                    <Minus className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Batch Action Bar when one or more lines are selected */}
      {totalSelectedCount > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 bg-shark-900 border border-shark-700/80 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 select-none">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <CheckSquare className="w-4 h-4 text-sky-400" />
            <span>
              {totalSelectedCount} line{totalSelectedCount > 1 ? "s" : ""} selected
            </span>
          </div>

          <div className="h-4 w-px bg-shark-750" />

          {!isStaged ? (
            <>
              <button
                onClick={handleStageAllSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Stage Selected Lines</span>
              </button>

              {onDiscardLines && (
                <button
                  onClick={handleDiscardAllSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Discard Selected Lines</span>
                </button>
              )}
            </>
          ) : (
            <button
              onClick={handleUnstageAllSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-shark-750 hover:bg-shark-700 text-slate-200 border border-shark-650 transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
              <span>Unstage Selected Lines</span>
            </button>
          )}

          <button
            onClick={() => {
              setSelectedLines(new Map());
              setLastSelected(null);
            }}
            className="p-1 text-slate-400 hover:text-slate-200 rounded transition-colors text-xs"
            title="Clear line selection (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
