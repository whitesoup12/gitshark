import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Tab, CommitNode } from "@/types";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { formatShortHash } from "@/lib/utils";
import { getCommitGraphIpc, listenToStatusChanged } from "@/lib/ipc";
import { CommitGraphCanvas } from "@/components/graph/CommitGraphCanvas";
import { CommitInspector } from "@/components/graph/CommitInspector";
import { CommitContextMenu } from "@/components/graph/CommitContextMenu";
import { WorkspaceDiffSplit } from "@/components/workspace/WorkspaceDiffSplit";
import { PullRequestComparisonView } from "@/components/pr/PullRequestComparisonView";
import {
  GitCommit,
  FileCode,
  GitPullRequest,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
  X,
  Filter,
} from "lucide-react";

interface MainViewportProps {
  tab: Tab;
}

export const MainViewport: React.FC<MainViewportProps> = ({ tab }) => {
  const {
    setActiveView,
    updateTab,
    executeCherryPick,
    executeRevert,
    checkoutCommit,
    createBranch,
    createTag,
    resetToCommit,
  } = useWorkspaceStore();
  const metadata = tab.metadata;

  const [commits, setCommits] = useState<CommitNode[]>([]);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const selectedHashRef = React.useRef(tab.selectedCommitHash);
  selectedHashRef.current = tab.selectedCommitHash;

  // Commit Graph Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [filterOnlyMatches, setFilterOnlyMatches] = useState(false);
  const [activeMatchCursor, setActiveMatchCursor] = useState(0);
  const [scrollToRowIndex, setScrollToRowIndex] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Right-click Commit Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    commit: CommitNode;
    x: number;
    y: number;
  } | null>(null);

  // Fetch topological commit DAG whenever repoId changes or refresh is requested
  const loadCommitGraph = useCallback(async (silent = false) => {
    if (!tab.repoId) return;

    if (!silent) {
      setIsLoadingGraph(true);
    }
    try {
      const graphNodes = await getCommitGraphIpc(tab.repoId, 1000, 0);
      setCommits(graphNodes);

      // Auto-select HEAD commit if nothing currently selected
      if (!selectedHashRef.current && graphNodes.length > 0) {
        updateTab(tab.id, { selectedCommitHash: graphNodes[0].hash });
      }
    } catch (err) {
      console.error("Failed to load commit graph:", err);
    } finally {
      if (!silent) {
        setIsLoadingGraph(false);
      }
    }
  }, [tab.repoId, tab.id, updateTab]);

  // 1. Reload graph on mount, repoId change, refreshEpoch increment, HEAD change, or branch switch
  useEffect(() => {
    loadCommitGraph();
  }, [
    tab.repoId,
    tab.refreshEpoch,
    tab.metadata?.head_commit_hash,
    tab.metadata?.current_branch,
    loadCommitGraph,
  ]);

  // 2. Also reload graph immediately when switching to the "graph" view
  useEffect(() => {
    if (tab.activeView === "graph") {
      loadCommitGraph();
    }
  }, [tab.activeView, loadCommitGraph]);

  // 3. Listen to filesystem watcher status changed events to reload graph in real-time
  useEffect(() => {
    if (!tab.repoId) return;

    let unlisten: (() => void) | null = null;
    listenToStatusChanged(tab.repoId, () => {
      if (tab.activeView === "graph") {
        loadCommitGraph(true);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [tab.repoId, tab.activeView, loadCommitGraph]);

  // 4. Ctrl+F / Cmd+F keyboard shortcut to open Commit Graph search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (tab.activeView !== "graph") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 20);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tab.activeView]);

  // Compute matching commits for search query
  const matchedCommits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return commits.filter((c) => {
      if (c.summary.toLowerCase().includes(q)) return true;
      if (c.hash.toLowerCase().includes(q)) return true;
      if (c.author.toLowerCase().includes(q)) return true;
      if (c.author_email.toLowerCase().includes(q)) return true;
      if (c.refs?.some((r) => r.shorthand.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [commits, searchQuery]);

  const matchedCommitHashes = useMemo(() => {
    return new Set(matchedCommits.map((c) => c.hash));
  }, [matchedCommits]);

  const displayedCommits = useMemo(() => {
    if (filterOnlyMatches && searchQuery.trim()) {
      return matchedCommits;
    }
    return commits;
  }, [commits, matchedCommits, filterOnlyMatches, searchQuery]);

  const jumpToMatch = useCallback(
    (cursorIndex: number) => {
      if (matchedCommits.length === 0) return;
      const normalized =
        ((cursorIndex % matchedCommits.length) + matchedCommits.length) %
        matchedCommits.length;
      setActiveMatchCursor(normalized);
      const targetHash = matchedCommits[normalized].hash;
      updateTab(tab.id, { selectedCommitHash: targetHash });

      const rowIdx = displayedCommits.findIndex((c) => c.hash === targetHash);
      if (rowIdx !== -1) {
        setScrollToRowIndex(rowIdx);
      }
    },
    [matchedCommits, displayedCommits, tab.id, updateTab]
  );

  // Auto-jump to first match when search query changes
  useEffect(() => {
    if (matchedCommits.length > 0 && searchQuery.trim()) {
      setActiveMatchCursor(0);
      const firstHash = matchedCommits[0].hash;
      updateTab(tab.id, { selectedCommitHash: firstHash });
      const rowIdx = displayedCommits.findIndex((c) => c.hash === firstHash);
      if (rowIdx !== -1) {
        setScrollToRowIndex(rowIdx);
      }
    } else {
      setScrollToRowIndex(null);
    }
  }, [searchQuery, filterOnlyMatches]);

  // Scroll to selected commit whenever tab.selectedCommitHash changes (e.g. clicked branch or tag)
  useEffect(() => {
    if (tab.selectedCommitHash) {
      const rowIdx = displayedCommits.findIndex(
        (c) => c.hash === tab.selectedCommitHash
      );
      if (rowIdx !== -1) {
        setScrollToRowIndex(rowIdx);
      }
    }
  }, [tab.selectedCommitHash, displayedCommits]);

  const handleSelectCommit = (hash: string) => {
    updateTab(tab.id, { selectedCommitHash: hash });
  };

  const handleContextMenuCommit = (commit: CommitNode, x: number, y: number) => {
    setContextMenu({ commit, x, y });
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
              tab.activeView === "status" || tab.activeView === "diff"
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

          <button
            onClick={() => setActiveView(tab.id, "pr")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              tab.activeView === "pr"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <GitPullRequest className="w-3.5 h-3.5" />
            <span>PR View</span>
          </button>
        </div>

        {/* Right: Repository Working Directory Badges & Refresh */}
        <div className="flex items-center gap-2 text-xs">
          {tab.activeView === "graph" && (
            <button
              onClick={() => {
                setIsSearchOpen((prev) => {
                  const next = !prev;
                  if (next) {
                    setTimeout(() => searchInputRef.current?.focus(), 20);
                  } else {
                    setSearchQuery("");
                  }
                  return next;
                });
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-medium transition-colors ${
                isSearchOpen || searchQuery.trim()
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                  : "bg-shark-950/60 border-shark-800 text-slate-400 hover:text-slate-200 hover:bg-shark-800"
              }`}
              title="Search Commits by message, SHA, author, or branch/tag (Ctrl+F)"
            >
              <Search className="w-3 h-3" />
              <span>Find Commit</span>
              <kbd className="hidden sm:inline-block text-[9px] px-1 py-0.2 rounded bg-shark-900 border border-shark-750 text-slate-500 font-mono">
                Ctrl+F
              </kbd>
            </button>
          )}

          <button
            onClick={() => loadCommitGraph()}
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
              <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-shrink-0">
                <span className="hidden md:inline-block text-[10px] text-slate-500">
                  Right-click any commit for Cherry-Pick, Revert, Branch, Tag, or Reset
                </span>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>HEAD</span>
                </div>
              </div>
            </div>

            {/* Search & Filter Bar (Ctrl+F) */}
            {isSearchOpen && (
              <div className="px-4 py-1.5 bg-shark-900/95 border-b border-shark-800 flex items-center justify-between gap-3 text-xs z-10">
                <div className="flex items-center gap-2 flex-1 max-w-xl">
                  <Search className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        jumpToMatch(e.shiftKey ? activeMatchCursor - 1 : activeMatchCursor + 1);
                      } else if (e.key === "Escape") {
                        setIsSearchOpen(false);
                        setSearchQuery("");
                      }
                    }}
                    placeholder="Search commits by message, SHA, author, branch, or tag..."
                    className="flex-1 bg-shark-950 border border-shark-750 focus:border-amber-400/60 rounded px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                  />

                  {searchQuery.trim() && (
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded border flex-shrink-0 ${
                        matchedCommits.length > 0
                          ? "bg-amber-950/50 border-amber-700/40 text-amber-300"
                          : "bg-rose-950/50 border-rose-800/40 text-rose-400"
                      }`}
                    >
                      {matchedCommits.length > 0
                        ? `${activeMatchCursor + 1} / ${matchedCommits.length}`
                        : "0 matches"}
                    </span>
                  )}

                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => jumpToMatch(activeMatchCursor - 1)}
                      disabled={matchedCommits.length === 0}
                      className="p-1 rounded bg-shark-800 hover:bg-shark-750 disabled:opacity-40 text-slate-300 transition-colors"
                      title="Previous match (Shift+Enter)"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => jumpToMatch(activeMatchCursor + 1)}
                      disabled={matchedCommits.length === 0}
                      className="p-1 rounded bg-shark-800 hover:bg-shark-750 disabled:opacity-40 text-slate-300 transition-colors"
                      title="Next match (Enter)"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilterOnlyMatches((prev) => !prev)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                      filterOnlyMatches
                        ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                        : "bg-shark-800 border-shark-750 text-slate-400 hover:text-slate-200"
                    }`}
                    title="Toggle between Highlight-in-DAG mode and Filter-Rows mode"
                  >
                    <Filter className="w-3 h-3" />
                    <span>{filterOnlyMatches ? "Filtered Rows" : "Highlight in Graph"}</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchQuery("");
                    }}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors"
                    title="Close search (Esc)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Virtualized Canvas Rendering Engine */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <CommitGraphCanvas
                commits={displayedCommits}
                selectedCommitHash={tab.selectedCommitHash}
                onSelectCommit={handleSelectCommit}
                onContextMenuCommit={handleContextMenuCommit}
                matchedCommitHashes={searchQuery.trim() ? matchedCommitHashes : undefined}
                scrollToRowIndex={scrollToRowIndex}
                isLoading={isLoadingGraph}
                pullRequests={tab.pullRequests}
              />
            </div>

            {/* Right-Click Context Menu for Commit Nodes */}
            {contextMenu && (
              <CommitContextMenu
                commit={contextMenu.commit}
                position={{ x: contextMenu.x, y: contextMenu.y }}
                currentBranch={metadata?.current_branch ?? "HEAD"}
                onClose={() => setContextMenu(null)}
                onCherryPick={(c) => {
                  executeCherryPick(tab.id, c.hash);
                }}
                onRevert={(c) => {
                  executeRevert(tab.id, c.hash);
                }}
                onCheckoutCommit={(c) => {
                  checkoutCommit(tab.id, c.hash);
                }}
                onCreateBranchFromCommit={async (c, branchName, checkout) => {
                  await createBranch(tab.id, branchName, c.hash, checkout);
                }}
                onCreateTagFromCommit={async (c, tagName, message, pushToRemote) => {
                  await createTag(tab.id, tagName, c.hash, message, pushToRemote ?? false);
                }}
                onResetToCommit={async (c, mode) => {
                  await resetToCommit(tab.id, c.hash, mode);
                }}
              />
            )}

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

        {tab.activeView === "pr" && (
          <PullRequestComparisonView tab={tab} />
        )}
      </div>
    </main>
  );
};
