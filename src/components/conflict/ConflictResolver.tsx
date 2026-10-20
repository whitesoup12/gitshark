import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Tab, ConflictFileDetails, ConflictBlock } from "@/types";
import {
  getConflictedFileDetailsIpc,
  resolveConflictChoiceIpc,
  saveAndStageResolvedFileIpc,
} from "@/lib/ipc";
import { showConfirm } from "@/store/useDialogStore";
import {
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Check,
  Split,
  Edit3,
  RotateCcw,
  Loader2,
  ShieldAlert,
} from "lucide-react";

interface ConflictResolverProps {
  tab: Tab;
  filePath: string;
  onResolved: () => void;
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({
  tab,
  filePath,
  onResolved,
}) => {
  const [details, setDetails] = useState<ConflictFileDetails | null>(null);
  const [currentContent, setCurrentContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"interactive" | "editor">("interactive");
  const [resolvedBlockIds, setResolvedBlockIds] = useState<Set<number>>(new Set());

  // Load conflict details from backend
  const loadDetails = useCallback(async () => {
    if (!tab.repoId || !filePath) return;
    setIsLoading(true);
    try {
      const data = await getConflictedFileDetailsIpc(tab.repoId, filePath);
      setDetails(data);
      setCurrentContent(data.full_content);
      setResolvedBlockIds(new Set());
    } catch (err) {
      console.error("Failed to load conflict details:", err);
    } finally {
      setIsLoading(false);
    }
  }, [tab.repoId, filePath]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  // Compute remaining conflict markers from live content
  const hasRemainingMarkers = useMemo(() => {
    return (
      currentContent.includes("<<<<<<<") &&
      currentContent.includes("=======") &&
      currentContent.includes(">>>>>>>")
    );
  }, [currentContent]);

  // Handle resolving a single conflict block
  const handleResolveBlock = (
    block: ConflictBlock,
    resolution: "ours" | "theirs" | "both-ours-first" | "both-theirs-first"
  ) => {
    let replacementText = "";
    if (resolution === "ours") {
      replacementText = block.ours_content;
    } else if (resolution === "theirs") {
      replacementText = block.theirs_content;
    } else if (resolution === "both-ours-first") {
      replacementText = block.ours_content + "\n" + block.theirs_content;
    } else if (resolution === "both-theirs-first") {
      replacementText = block.theirs_content + "\n" + block.ours_content;
    }

    // Reconstruct the file content replacing the specific conflict block
    const lines = currentContent.split("\n");
    let markerStart = -1;
    let markerEnd = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("<<<<<<<")) {
        // Find matching block
        let j = i;
        while (j < lines.length && !lines[j].startsWith(">>>>>>>")) {
          j++;
        }
        if (j < lines.length && lines[j].startsWith(">>>>>>>")) {
          // Check if this matches block's ours/theirs content
          const blockSlice = lines.slice(i, j + 1).join("\n");
          if (
            blockSlice.includes(block.ours_content.trim()) ||
            blockSlice.includes(block.theirs_content.trim())
          ) {
            markerStart = i;
            markerEnd = j;
            break;
          }
        }
      }
    }

    if (markerStart !== -1 && markerEnd !== -1) {
      const before = lines.slice(0, markerStart);
      const after = lines.slice(markerEnd + 1);
      const newLines = replacementText
        ? [...before, ...replacementText.split("\n"), ...after]
        : [...before, ...after];
      const updated = newLines.join("\n");
      setCurrentContent(updated);
      setResolvedBlockIds((prev) => new Set(prev).add(block.id));
    } else {
      // Fallback: replace first occurrence of the marker block
      const markerRegex = new RegExp(
        `<<<<<<<[\\s\\S]*?${escapeRegExp(block.theirs_header)}[^\n]*\n?`,
        "m"
      );
      const updated = currentContent.replace(markerRegex, replacementText + (replacementText ? "\n" : ""));
      setCurrentContent(updated);
      setResolvedBlockIds((prev) => new Set(prev).add(block.id));
    }
  };

  function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Entire file: Take all ours
  const handleTakeAllOurs = async () => {
    const confirmed = await showConfirm({
      title: "Resolve Entire File with Current (Ours)",
      message: `Accept HEAD's version for all conflicts in '${filePath}' and mark as resolved?`,
      confirmText: "Accept All Current",
      variant: "info",
    });
    if (!confirmed || !tab.repoId) return;

    setIsSaving(true);
    try {
      await resolveConflictChoiceIpc(tab.repoId, filePath, "ours");
      onResolved();
    } catch (err) {
      console.error("Failed to resolve with ours:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Entire file: Take all theirs
  const handleTakeAllTheirs = async () => {
    const confirmed = await showConfirm({
      title: "Resolve Entire File with Incoming (Theirs)",
      message: `Accept incoming branch version for all conflicts in '${filePath}' and mark as resolved?`,
      confirmText: "Accept All Incoming",
      variant: "info",
    });
    if (!confirmed || !tab.repoId) return;

    setIsSaving(true);
    try {
      await resolveConflictChoiceIpc(tab.repoId, filePath, "theirs");
      onResolved();
    } catch (err) {
      console.error("Failed to resolve with theirs:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Save current resolved content to disk and stage
  const handleSaveAndMarkResolved = async () => {
    if (!tab.repoId) return;

    if (hasRemainingMarkers) {
      const proceed = await showConfirm({
        title: "Conflict Markers Still Present",
        message:
          "There appear to still be conflict markers (<<<<<<< / ======= / >>>>>>>) in the file. Are you sure you want to mark this file as resolved?",
        confirmText: "Mark Resolved Anyway",
        variant: "warning",
      });
      if (!proceed) return;
    }

    setIsSaving(true);
    try {
      await saveAndStageResolvedFileIpc(tab.repoId, filePath, currentContent);
      onResolved();
    } catch (err) {
      console.error("Failed to save and stage resolved file:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-shark-950 text-slate-400 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
        <span className="text-xs font-mono">Analyzing conflicts in {filePath}...</span>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-shark-950 text-slate-400 p-6 text-center">
        <ShieldAlert className="w-10 h-10 text-rose-400 mb-2" />
        <div className="text-sm font-semibold text-slate-200">Unable to load conflict details</div>
        <p className="text-xs text-slate-400 mt-1 max-w-md">
          The file may have been moved or resolved externally.
        </p>
        <button
          onClick={loadDetails}
          className="mt-4 px-3 py-1.5 bg-shark-800 hover:bg-shark-750 text-slate-200 rounded text-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  const blocks = details.blocks;
  const totalBlocks = blocks.length;
  const resolvedCount = resolvedBlockIds.size;
  const allResolved = !hasRemainingMarkers;

  return (
    <div className="flex-1 flex flex-col h-full bg-shark-950 overflow-hidden font-sans border-l border-shark-800">
      {/* Top Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-shark-900 border-b border-shark-800 select-none">
        {/* Left: File Badge & Conflict Counter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
            <FileCode className="w-4 h-4 text-rose-400" />
            <span className="font-semibold text-rose-300 font-mono">{fileName}</span>
            <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
              ({filePath})
            </span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
              allResolved
                ? "bg-emerald-950/80 border border-emerald-800 text-emerald-300"
                : "bg-rose-950/80 border border-rose-800 text-rose-300"
            }`}
          >
            {allResolved ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>All conflicts resolved</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span>
                  {totalBlocks > 0
                    ? `${resolvedCount} of ${totalBlocks} resolved`
                    : "Conflict markers detected"}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Quick Whole-File Actions & Resolve Button */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-shark-950 border border-shark-750 rounded p-0.5 text-[11px]">
            <button
              onClick={() => setViewMode("interactive")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                viewMode === "interactive"
                  ? "bg-sky-600 text-white font-medium shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Interactive conflict blocks view"
            >
              <Split className="w-3 h-3" />
              <span>Interactive</span>
            </button>
            <button
              onClick={() => setViewMode("editor")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                viewMode === "editor"
                  ? "bg-sky-600 text-white font-medium shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Direct code editor view"
            >
              <Edit3 className="w-3 h-3" />
              <span>Editor</span>
            </button>
          </div>

          {/* Quick Choice Buttons */}
          <button
            onClick={handleTakeAllOurs}
            disabled={isSaving}
            className="px-2.5 py-1 bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-800/80 text-cyan-200 rounded text-xs font-medium transition-colors"
            title="Accept current branch version for entire file"
          >
            Take All Current
          </button>

          <button
            onClick={handleTakeAllTheirs}
            disabled={isSaving}
            className="px-2.5 py-1 bg-purple-950/70 hover:bg-purple-900/80 border border-purple-800/80 text-purple-200 rounded text-xs font-medium transition-colors"
            title="Accept incoming branch version for entire file"
          >
            Take All Incoming
          </button>

          <button
            onClick={loadDetails}
            disabled={isSaving}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-shark-800"
            title="Reset to file on disk"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Primary Save & Mark Resolved Button */}
          <button
            onClick={handleSaveAndMarkResolved}
            disabled={isSaving}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold text-xs transition-all shadow-md ${
              allResolved
                ? "bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse"
                : "bg-sky-600 hover:bg-sky-500 text-white"
            }`}
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>Mark as Resolved</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === "editor" ? (
        /* Direct Code Editor View */
        <div className="flex-1 flex flex-col min-h-0 p-3 bg-shark-950 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 text-[11px] text-slate-400">
            <span>Edit the file directly to remove conflict markers and finalize changes:</span>
            {hasRemainingMarkers ? (
              <span className="text-rose-400 flex items-center gap-1 font-sans">
                <AlertTriangle className="w-3 h-3" /> Markers still present
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1 font-sans">
                <CheckCircle2 className="w-3 h-3" /> No conflict markers
              </span>
            )}
          </div>
          <textarea
            value={currentContent}
            onChange={(e) => setCurrentContent(e.target.value)}
            className="flex-1 w-full p-3 bg-shark-900 border border-shark-800 focus:border-sky-500 rounded text-slate-200 outline-none resize-none leading-relaxed font-mono select-text"
            spellCheck={false}
          />
        </div>
      ) : (
        /* Interactive Conflict Blocks View */
        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
          {allResolved && (
            <div className="flex items-center justify-between p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-emerald-200 text-xs shadow-md animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-emerald-100">
                    All conflicts in this file have been resolved!
                  </div>
                  <div className="text-[11px] text-emerald-300/80 mt-0.5">
                    Click "Mark as Resolved" to stage this file and continue your merge.
                  </div>
                </div>
              </div>
              <button
                onClick={handleSaveAndMarkResolved}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded text-xs shadow transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save & Stage</span>
              </button>
            </div>
          )}

          {blocks.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              {hasRemainingMarkers ? (
                <div>
                  <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                  <div>Standard conflict blocks could not be cleanly separated.</div>
                  <div className="mt-1 text-slate-500">
                    Switch to the <strong>Editor</strong> tab to view and edit markers directly.
                  </div>
                </div>
              ) : (
                <div className="text-slate-300">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <div className="font-semibold text-sm">No unresolved conflict blocks found.</div>
                  <div className="mt-1 text-slate-500">
                    This file is ready to be staged as resolved.
                  </div>
                </div>
              )}
            </div>
          ) : (
            blocks.map((block, idx) => {
              const isResolved = resolvedBlockIds.has(block.id);

              return (
                <div
                  key={block.id}
                  className={`border rounded-lg overflow-hidden transition-all shadow-sm ${
                    isResolved
                      ? "border-emerald-800/50 bg-shark-900/40 opacity-70"
                      : "border-shark-750 bg-shark-900 shadow-md"
                  }`}
                >
                  {/* Block Header & Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-shark-850 border-b border-shark-800 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] px-1.5 py-0.5 bg-shark-800 border border-shark-700 text-slate-300 rounded font-bold">
                        Conflict #{idx + 1}
                      </span>
                      {isResolved && (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                          <Check className="w-3 h-3" /> Resolved
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => handleResolveBlock(block, "ours")}
                        className="px-2 py-0.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-cyan-200 rounded text-[11px] font-medium transition-colors"
                        title="Accept Current Change (HEAD)"
                      >
                        Accept Current
                      </button>

                      <button
                        onClick={() => handleResolveBlock(block, "theirs")}
                        className="px-2 py-0.5 bg-purple-950/80 hover:bg-purple-900 border border-purple-800 text-purple-200 rounded text-[11px] font-medium transition-colors"
                        title="Accept Incoming Change"
                      >
                        Accept Incoming
                      </button>

                      <button
                        onClick={() => handleResolveBlock(block, "both-ours-first")}
                        className="px-2 py-0.5 bg-shark-800 hover:bg-shark-750 border border-shark-700 text-slate-300 rounded text-[11px] transition-colors"
                        title="Accept Both (Current First, then Incoming)"
                      >
                        Accept Both
                      </button>
                    </div>
                  </div>

                  {/* Conflict Block Body: Side-by-Side or Stacked Diff */}
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-shark-800 font-mono text-xs">
                    {/* Left: Current Change (Ours) */}
                    <div className="flex flex-col bg-cyan-950/15">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-cyan-950/40 border-b border-cyan-900/40 text-[11px] text-cyan-300 font-semibold select-none">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-cyan-400" />
                          <span>Current Change ({block.ours_header || "HEAD"})</span>
                        </div>
                        <button
                          onClick={() => handleResolveBlock(block, "ours")}
                          className="hover:underline text-[10px] text-cyan-200"
                        >
                          Use this
                        </button>
                      </div>
                      <div className="p-3 text-cyan-100 whitespace-pre overflow-x-auto leading-relaxed select-text flex-1">
                        {block.ours_content || (
                          <span className="italic text-slate-500 font-sans">(Empty)</span>
                        )}
                      </div>
                    </div>

                    {/* Right: Incoming Change (Theirs) */}
                    <div className="flex flex-col bg-purple-950/15">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-purple-950/40 border-b border-purple-900/40 text-[11px] text-purple-300 font-semibold select-none">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-purple-400" />
                          <span>Incoming Change ({block.theirs_header || "Incoming"})</span>
                        </div>
                        <button
                          onClick={() => handleResolveBlock(block, "theirs")}
                          className="hover:underline text-[10px] text-purple-200"
                        >
                          Use this
                        </button>
                      </div>
                      <div className="p-3 text-purple-100 whitespace-pre overflow-x-auto leading-relaxed select-text flex-1">
                        {block.theirs_content || (
                          <span className="italic text-slate-500 font-sans">(Empty)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
