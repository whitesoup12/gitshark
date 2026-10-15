import React, { useEffect, useState, useCallback } from "react";
import { Tab, CommitNode } from "@/types";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { formatShortHash } from "@/lib/utils";
import { getCommitGraphIpc } from "@/lib/ipc";
import { CommitGraphCanvas } from "@/components/graph/CommitGraphCanvas";
import { CommitInspector } from "@/components/graph/CommitInspector";
import { WorkspaceDiffSplit } from "@/components/workspace/WorkspaceDiffSplit";
import {
  GitCommit,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
} from "lucide-react";

interface MainViewportProps {
  tab: Tab;
}

export const MainViewport: React.FC<MainViewportProps> = ({ tab }) => {
  const { setActiveView, updateTab } = useWorkspaceStore();
  const metadata = tab.metadata;

  const [commits, setCommits] = useState<CommitNode[]>([]);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);

  // Fetch topological commit DAG whenever repoId changes or refresh is requested
  const loadCommitGraph = useCallback(async () => {
    if (!tab.repoId) return;

    setIsLoadingGraph(true);
    try {
      const graphNodes = await getCommitGraphIpc(tab.repoId, 1000, 0);
      setCommits(graphNodes);

      // Auto-select HEAD commit if nothing currently selected
      if (!tab.selectedCommitHash && graphNodes.length > 0) {
        updateTab(tab.id, { selectedCommitHash: graphNodes[0].hash });
      }
    } catch (err) {
      console.error("Failed to load commit graph:", err);
    } finally {
      setIsLoadingGraph(false);
    }
  }, [tab.repoId, tab.id, tab.selectedCommitHash, updateTab]);

  useEffect(() => {
    loadCommitGraph();
  }, [tab.repoId]);

  const handleSelectCommit = (hash: string) => {
    updateTab(tab.id, { selectedCommitHash: hash });
  };

  const selectedCommit = commits.find(
    (c) => c.hash === tab.selectedCommitHash
  );

  return (
    <main className="flex-1 flex flex-col bg-shark-950 overflow-hidden">
      {/* Top Viewport Header & Status Bar */}
      <div className="flex items-center justify-between px-4 h-11 bg-shark-900 border-b border-shark-800 select-none">
        {/* Left: View Modes Switcher */}
        <div className="flex items-center gap-1 bg-shark-950/60 p-0.5 rounded-lg border border-shark-800">
          <button
            onClick={() => setActiveView(tab.id, "status")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              tab.activeView !== "graph"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Working Changes & Diff</span>
            {((metadata?.staged_count ?? 0) + (metadata?.unstaged_count ?? 0) + (metadata?.untracked_count ?? 0)) > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 font-mono font-medium">
                {(metadata?.staged_count ?? 0) + (metadata?.unstaged_count ?? 0) + (metadata?.untracked_count ?? 0)}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveView(tab.id, "graph")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              tab.activeView === "graph"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <GitCommit className="w-3.5 h-3.5" />
            <span>Commit Graph</span>
            {commits.length > 0 && (
              <span className="text-[10px] px-1 rounded bg-sky-950 text-sky-400 font-mono">
                {commits.length}
              </span>
            )}
          </button>
        </div>

        {/* Right: Repository Working Directory Badges & Refresh */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={loadCommitGraph}
            disabled={isLoadingGraph}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors mr-1"
            title="Reload Commit Graph"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoadingGraph ? "animate-spin text-sky-400" : ""}`}
            />
          </button>

          {/* Staged files badge */}
          <button
            onClick={() => setActiveView(tab.id, "status")}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/40 transition-colors cursor-pointer"
            title="Staged files ready to commit (Click to view changes)"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>{metadata?.staged_count ?? 0} Staged</span>
          </button>

          {/* Unstaged files badge */}
          <button
            onClick={() => setActiveView(tab.id, "status")}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/40 text-amber-400 hover:bg-amber-900/40 transition-colors cursor-pointer"
            title="Modified unstaged files (Click to view changes)"
          >
            <AlertCircle className="w-3 h-3" />
            <span>{metadata?.unstaged_count ?? 0} Unstaged</span>
          </button>

          {/* Untracked files badge */}
          <button
            onClick={() => setActiveView(tab.id, "status")}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/50 border border-shark-750 text-slate-300 hover:bg-slate-700/50 transition-colors cursor-pointer"
            title="Untracked files (Click to view changes)"
          >
            <span>{metadata?.untracked_count ?? 0} Untracked</span>
          </button>
        </div>
      </div>

      {/* Main Content Area based on View Mode */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {tab.activeView === "graph" && (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* HEAD Commit Header Banner */}
            <div className="px-4 py-2 bg-shark-900/60 border-b border-shark-800/80 flex items-center justify-between text-xs select-none">
              <div className="flex items-center gap-3 truncate">
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-shark-800 text-sky-300 border border-shark-700">
                  {formatShortHash(metadata?.head_commit_hash)}
                </span>
                <span className="text-slate-200 font-medium truncate">
                  {metadata?.head_commit_summary ?? "No commit summary"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>HEAD</span>
              </div>
            </div>

            {/* Virtualized Canvas Rendering Engine */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <CommitGraphCanvas
                commits={commits}
                selectedCommitHash={tab.selectedCommitHash}
                onSelectCommit={handleSelectCommit}
                isLoading={isLoadingGraph}
              />
            </div>

            {/* Selected Commit Inspection Drawer */}
            {selectedCommit && (
              <CommitInspector
                repoId={tab.repoId ?? ""}
                commit={selectedCommit}
                onClose={() => updateTab(tab.id, { selectedCommitHash: null })}
                onSelectCommit={handleSelectCommit}
              />
            )}
          </div>
        )}

        {(tab.activeView === "diff" || tab.activeView === "status") && (
          <WorkspaceDiffSplit tab={tab} />
        )}
      </div>
    </main>
  );
};
