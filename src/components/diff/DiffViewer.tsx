import React, { useState } from "react";
import { FileDiff } from "@/types";
import {
  Split,
  AlignJustify,
  Plus,
  Minus,
  FileCode,
  AlertCircle,
  RotateCw,
} from "lucide-react";

interface DiffViewerProps {
  diff: FileDiff | null;
  filePath: string | null;
  isStaged: boolean;
  onStageHunk: (patch: string) => void;
  onDiscardHunk?: (patch: string) => void;
  onToggleStageFile: () => void;
  isLoading?: boolean;
  isRefreshing?: boolean;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diff,
  filePath,
  isStaged,
  onStageHunk,
  onDiscardHunk,
  onToggleStageFile,
  isLoading = false,
  isRefreshing = false,
}) => {
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified");

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
            Select a modified or staged file from the left drawer to review line-by-line diff hunks, stage individual patches, or discard changes.
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
    <div className="flex-1 flex flex-col bg-shark-950 h-full overflow-hidden select-none">
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

        {/* Right: View Mode Toggle & Primary Stage/Unstage Action */}
        <div className="flex items-center gap-2">
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
          diff.hunks.map((hunk, hunkIdx) => (
            <div
              key={hunkIdx}
              className="rounded-lg border border-shark-800/90 overflow-hidden bg-shark-900/40 shadow-sm"
            >
              {/* Sticky Hunk Header with Action Hover */}
              <div className="group flex items-center justify-between px-3 py-1.5 bg-shark-850 border-b border-shark-800 text-slate-400 select-none">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-sky-400">
                    {hunk.header}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Hunk {hunkIdx + 1} of {diff.hunks.length}
                  </span>
                </div>

                {/* Hunk Staging / Discard Actions */}
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isStaged ? (
                    <>
                      {onDiscardHunk && (
                        <button
                          onClick={() => onDiscardHunk(hunk.patch)}
                          className="px-2 py-0.5 rounded text-[10px] bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition-colors"
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
                      onClick={() => onStageHunk(hunk.patch)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-shark-750 hover:bg-shark-700 text-slate-200 border border-shark-700 transition-colors"
                      title="Unstage this hunk"
                    >
                      <Minus className="w-2.5 h-2.5" />
                      <span>Unstage Hunk</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Hunk Lines Rendering */}
              {viewMode === "unified" ? (
                /* Unified View */
                <div className="divide-y divide-shark-900/30">
                  {hunk.lines.map((line, lineIdx) => {
                    const isAdd = line.origin === "+";
                    const isDel = line.origin === "-";

                    return (
                      <div
                        key={lineIdx}
                        className={`flex items-start select-text ${
                          isAdd
                            ? "bg-emerald-950/30 text-emerald-300 border-l-2 border-emerald-500"
                            : isDel
                            ? "bg-rose-950/35 text-rose-300 border-l-2 border-rose-500"
                            : "text-slate-300 border-l-2 border-transparent"
                        }`}
                      >
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
                        <span className="flex-1 py-0.5 pr-2 whitespace-pre overflow-x-auto">
                          {line.content || " "}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Split Side-by-Side View */
                <div className="divide-y divide-shark-900/40">
                  {hunk.lines.map((line, lineIdx) => {
                    const isAdd = line.origin === "+";
                    const isDel = line.origin === "-";

                    return (
                      <div key={lineIdx} className="grid grid-cols-2 divide-x divide-shark-800 select-text">
                        {/* Left column (Old) */}
                        <div
                          className={`flex items-start ${
                            isDel
                              ? "bg-rose-950/35 text-rose-300"
                              : isAdd
                              ? "bg-shark-950/50 text-transparent select-none"
                              : "text-slate-300"
                          }`}
                        >
                          <span className="w-10 px-2 py-0.5 text-right text-slate-500 select-none text-[10.5px] border-r border-shark-800/60">
                            {line.old_lineno ?? ""}
                          </span>
                          <span className="w-5 py-0.5 text-center font-bold select-none text-rose-400">
                            {isDel ? "-" : ""}
                          </span>
                          <span className="flex-1 py-0.5 pr-2 whitespace-pre overflow-x-auto">
                            {!isAdd ? line.content : ""}
                          </span>
                        </div>

                        {/* Right column (New) */}
                        <div
                          className={`flex items-start ${
                            isAdd
                              ? "bg-emerald-950/30 text-emerald-300"
                              : isDel
                              ? "bg-shark-950/50 text-transparent select-none"
                              : "text-slate-300"
                          }`}
                        >
                          <span className="w-10 px-2 py-0.5 text-right text-slate-500 select-none text-[10.5px] border-r border-shark-800/60">
                            {line.new_lineno ?? ""}
                          </span>
                          <span className="w-5 py-0.5 text-center font-bold select-none text-emerald-400">
                            {isAdd ? "+" : ""}
                          </span>
                          <span className="flex-1 py-0.5 pr-2 whitespace-pre overflow-x-auto">
                            {!isDel ? line.content : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
