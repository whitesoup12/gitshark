import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Tab, BranchComparisonDetails, FileDiff } from "@/types";
import { DiffViewer } from "@/components/diff/DiffViewer";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useSharkStore } from "@/store/useSharkStore";
import {
  GitPullRequest,
  ArrowLeftRight,
  GitCommit,
  FileCode,
  RotateCw,
  ExternalLink,
  Copy,
  Check,
  Search,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

interface PullRequestComparisonViewProps {
  tab: Tab;
}

export const PullRequestComparisonView: React.FC<PullRequestComparisonViewProps> = ({ tab }) => {
  const {
    fetchBranchComparison,
    fetchBranchComparisonFileDiff,
    createPullRequestInBrowser,
    updateTab,
  } = useWorkspaceStore();

  const metadata = tab.metadata;
  const currentBranch = metadata?.current_branch || "main";

  const defaultBranch = useMemo(() => {
    const hasMain =
      tab.branches?.local.some((b) => b.shorthand === "main") ||
      tab.branches?.remote.some((b) => b.shorthand.endsWith("/main"));
    const hasMaster =
      tab.branches?.local.some((b) => b.shorthand === "master") ||
      tab.branches?.remote.some((b) => b.shorthand.endsWith("/master"));
    return hasMain ? "main" : hasMaster ? "master" : "main";
  }, [tab.branches]);

  // Base branch defaults to main/master; compare branch defaults to active branch (or feature branch)
  const [baseBranch, setBaseBranch] = useState<string>(() => {
    if (tab.prCompareBase) return tab.prCompareBase;
    return defaultBranch;
  });

  const [compareBranch, setCompareBranch] = useState<string>(() => {
    if (tab.prCompareTarget) return tab.prCompareTarget;
    if (currentBranch !== defaultBranch) return currentBranch;
    return currentBranch;
  });

  const [comparison, setComparison] = useState<BranchComparisonDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [includeUncommitted, setIncludeUncommitted] = useState<boolean>(true);

  const isCurrentBranch = useMemo(() => {
    return compareBranch === currentBranch || compareBranch.endsWith(`/${currentBranch}`);
  }, [compareBranch, currentBranch]);

  const [activeTab, setActiveTab] = useState<"files" | "commits">("files");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(tab.prSelectedFile || null);
  const [selectedFileDiff, setSelectedFileDiff] = useState<FileDiff | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  // Available branches list combining local and remote
  const availableBranches = useMemo(() => {
    const list: string[] = [];
    if (tab.branches) {
      for (const b of tab.branches.local) {
        if (!list.includes(b.shorthand)) {
          list.push(b.shorthand);
        }
      }
      for (const b of tab.branches.remote) {
        if (!list.includes(b.shorthand)) {
          list.push(b.shorthand);
        }
      }
    }
    if (list.length === 0) {
      list.push(defaultBranch);
      if (currentBranch !== defaultBranch) {
        list.push(currentBranch);
      }
    }
    return list;
  }, [tab.branches, defaultBranch, currentBranch]);

  // Matching pull request if already created on GitHub/GitLab
  const activePrInfo = useMemo(() => {
    if (!tab.pullRequests || tab.pullRequests.length === 0) return null;
    return tab.pullRequests.find((pr) => pr.source_branch === compareBranch);
  }, [tab.pullRequests, compareBranch]);

  // Load branch comparison
  const loadComparison = useCallback(async () => {
    if (!tab.id || !baseBranch || !compareBranch) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchBranchComparison(
        tab.id,
        baseBranch,
        compareBranch,
        includeUncommitted && isCurrentBranch
      );
      if (result) {
        setComparison(result);
        // If previous selected file still in comparison, keep it; otherwise select first file
        setSelectedFilePath((prev) => {
          if (prev && result.files.some((f) => f.path === prev)) {
            return prev;
          }
          return result.files[0]?.path || null;
        });
      } else {
        setComparison(null);
      }
    } catch (err) {
      console.error("Failed to load branch comparison:", err);
      setError(err instanceof Error ? err.message : String(err));
      setComparison(null);
    } finally {
      setIsLoading(false);
    }
  }, [tab.id, baseBranch, compareBranch, includeUncommitted, isCurrentBranch, fetchBranchComparison]);

  useEffect(() => {
    loadComparison();
  }, [loadComparison, tab.refreshEpoch]);

  // Load diff for selected file
  const loadFileDiff = useCallback(async () => {
    if (!tab.id || !baseBranch || !compareBranch || !selectedFilePath) {
      setSelectedFileDiff(null);
      return;
    }
    setIsLoadingDiff(true);
    try {
      const diff = await fetchBranchComparisonFileDiff(
        tab.id,
        baseBranch,
        compareBranch,
        selectedFilePath,
        includeUncommitted && isCurrentBranch
      );
      setSelectedFileDiff(diff);
    } catch (err) {
      console.error(`Failed to load PR diff for ${selectedFilePath}:`, err);
      setSelectedFileDiff(null);
    } finally {
      setIsLoadingDiff(false);
    }
  }, [
    tab.id,
    baseBranch,
    compareBranch,
    selectedFilePath,
    includeUncommitted,
    isCurrentBranch,
    fetchBranchComparisonFileDiff,
  ]);

  useEffect(() => {
    loadFileDiff();
  }, [loadFileDiff, tab.refreshEpoch]);

  // Swap base and compare branches
  const handleSwapBranches = () => {
    const prevBase = baseBranch;
    const prevCompare = compareBranch;
    setBaseBranch(prevCompare);
    setCompareBranch(prevBase);
    updateTab(tab.id, {
      prCompareBase: prevCompare,
      prCompareTarget: prevBase,
    });
  };

  // Copy Markdown PR Summary
  const handleCopySummary = () => {
    if (!comparison) return;
    const lines: string[] = [];
    lines.push(`## PR: ${comparison.compare_ref} ➔ ${comparison.base_ref}`);
    lines.push("");
    lines.push(`- **Ahead**: ${comparison.ahead} commit${comparison.ahead === 1 ? "" : "s"}`);
    if (comparison.behind > 0) {
      lines.push(`- **Behind**: ${comparison.behind} commit${comparison.behind === 1 ? "" : "s"}`);
    }
    lines.push(`- **Files Changed**: ${comparison.files.length} (+${comparison.total_additions} / -${comparison.total_deletions})`);
    lines.push("");
    lines.push("### Commits");
    for (const c of comparison.commits) {
      lines.push(`- \`${c.hash.slice(0, 7)}\` ${c.summary} (${c.author_name})`);
    }
    lines.push("");
    lines.push("### Files Changed");
    for (const f of comparison.files) {
      lines.push(`- \`${f.path}\` (${f.status}) +${f.additions} -${f.deletions}`);
    }

    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedSummary(true);
    useSharkStore.getState().recordSharkStat("pr", 1);
    useSharkStore.getState().triggerCelebration("chomp", "Copied PR Summary to clipboard! 📋🦈");
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // Filtered files & commits
  const filteredFiles = useMemo(() => {
    if (!comparison) return [];
    if (!searchQuery.trim()) return comparison.files;
    const q = searchQuery.toLowerCase();
    return comparison.files.filter((f) => f.path.toLowerCase().includes(q));
  }, [comparison, searchQuery]);

  const filteredCommits = useMemo(() => {
    if (!comparison) return [];
    if (!searchQuery.trim()) return comparison.commits;
    const q = searchQuery.toLowerCase();
    return comparison.commits.filter(
      (c) =>
        c.summary.toLowerCase().includes(q) ||
        c.author_name.toLowerCase().includes(q) ||
        c.hash.toLowerCase().includes(q)
    );
  }, [comparison, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "added":
        return (
          <span className="w-4 h-4 rounded flex items-center justify-center font-bold text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
            A
          </span>
        );
      case "deleted":
        return (
          <span className="w-4 h-4 rounded flex items-center justify-center font-bold text-[9px] bg-rose-500/20 text-rose-400 border border-rose-500/30 flex-shrink-0">
            D
          </span>
        );
      case "renamed":
        return (
          <span className="w-4 h-4 rounded flex items-center justify-center font-bold text-[9px] bg-sky-500/20 text-sky-400 border border-sky-500/30 flex-shrink-0">
            R
          </span>
        );
      case "modified":
      default:
        return (
          <span className="w-4 h-4 rounded flex items-center justify-center font-bold text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 flex-shrink-0">
            M
          </span>
        );
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const diff = Math.floor(Date.now() / 1000) - timestamp;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="flex-1 flex flex-col bg-shark-950 overflow-hidden select-none">
      {/* Top PR Header Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-shark-900 border-b border-shark-800 flex-shrink-0 text-xs">
        {/* Left: Branch Selectors & Compare Direction */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-sky-950/60 border border-sky-800/50 text-sky-300 font-semibold text-xs">
            <GitPullRequest className="w-3.5 h-3.5" />
            <span>PR View</span>
          </div>

          <div className="flex items-center bg-shark-950 border border-shark-800 rounded-lg p-1 gap-1.5">
            {/* Base Branch Selector */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 px-1">base:</span>
              <div className="relative">
                <select
                  value={baseBranch}
                  onChange={(e) => {
                    const nextBase = e.target.value;
                    setBaseBranch(nextBase);
                    updateTab(tab.id, { prCompareBase: nextBase });
                  }}
                  className="bg-shark-900 border border-shark-750 text-slate-200 text-xs font-mono rounded px-2 py-0.5 outline-none focus:border-sky-500 cursor-pointer max-w-[160px] truncate"
                >
                  {availableBranches.map((b) => (
                    <option key={`base-${b}`} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Swap Button */}
            <button
              onClick={handleSwapBranches}
              className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-shark-850 transition-colors"
              title="Swap base and compare branches"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>

            {/* Compare Branch Selector */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 px-1">compare:</span>
              <div className="relative">
                <select
                  value={compareBranch}
                  onChange={(e) => {
                    const nextCompare = e.target.value;
                    setCompareBranch(nextCompare);
                    updateTab(tab.id, { prCompareTarget: nextCompare });
                  }}
                  className="bg-shark-900 border border-shark-750 text-sky-300 font-semibold text-xs font-mono rounded px-2 py-0.5 outline-none focus:border-sky-500 cursor-pointer max-w-[160px] truncate"
                >
                  {availableBranches.map((b) => (
                    <option key={`comp-${b}`} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={loadComparison}
              disabled={isLoading}
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-shark-850 transition-colors disabled:opacity-40"
              title="Refresh comparison"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-sky-400" : ""}`} />
            </button>
          </div>

          {/* Uncommitted changes toggle */}
          <label
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
              !isCurrentBranch
                ? "opacity-50 cursor-not-allowed bg-shark-950/40 border-shark-850 text-slate-500"
                : includeUncommitted
                ? "bg-amber-950/30 border-amber-800/60 text-amber-300 hover:bg-amber-950/50"
                : "bg-shark-950 border-shark-800 text-slate-400 hover:text-slate-200 hover:border-shark-750"
            }`}
            title={
              isCurrentBranch
                ? "Include uncommitted working tree and staged changes in the PR comparison"
                : "Uncommitted changes can only be included when comparing the active branch"
            }
          >
            <input
              type="checkbox"
              checked={includeUncommitted && isCurrentBranch}
              disabled={!isCurrentBranch}
              onChange={(e) => setIncludeUncommitted(e.target.checked)}
              className="rounded border-shark-700 bg-shark-900 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed w-3.5 h-3.5"
            />
            <span className="font-medium text-[11px]">Include uncommitted</span>
          </label>

          {/* Metrics Badges */}
          {comparison && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono text-[11px] font-semibold">
                {comparison.ahead} ahead
              </span>
              {comparison.behind > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/60 font-mono text-[11px] font-semibold" title="Compare branch is behind base branch">
                  {comparison.behind} behind
                </span>
              )}
              {includeUncommitted && isCurrentBranch && (
                <span className="px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 font-mono text-[11px] font-medium" title="Uncommitted changes from working directory are included">
                  +working tree
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full bg-shark-850 text-slate-300 border border-shark-750 font-mono text-[11px]">
                {comparison.files.length} file{comparison.files.length === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-1 font-mono text-[11px]">
                <span className="text-emerald-400">+{comparison.total_additions}</span>
                <span className="text-rose-400">-{comparison.total_deletions}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Remote PR badge & PR Actions */}
        <div className="flex items-center gap-2">
          {activePrInfo && (
            <a
              href={activePrInfo.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800/60 transition-colors text-xs"
              title={`View PR #${activePrInfo.number} on web`}
            >
              <GitPullRequest className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-semibold">#{activePrInfo.number}</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          )}

          <button
            onClick={handleCopySummary}
            disabled={!comparison}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-shark-800 hover:bg-shark-750 text-slate-300 hover:text-slate-100 border border-shark-700 transition-colors text-xs disabled:opacity-40"
            title="Copy PR Summary markdown formatted with commit log and files changed"
          >
            {copiedSummary ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          <button
            onClick={() => createPullRequestInBrowser(tab.id, compareBranch)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-sm transition-colors text-xs"
            title="Open GitHub/GitLab pull request creation page in web browser"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Create PR</span>
          </button>
        </div>
      </div>

      {/* Main Viewport Body */}
      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">Comparison Failed</h3>
          <p className="text-xs text-rose-300/80 max-w-md font-mono bg-rose-950/40 p-3 rounded-lg border border-rose-900/40">
            {error}
          </p>
          <button
            onClick={loadComparison}
            className="px-3 py-1 bg-shark-800 hover:bg-shark-750 text-slate-200 rounded border border-shark-700 text-xs transition-colors"
          >
            Retry Comparison
          </button>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Drawer: PR Files & Commits List */}
          <aside className="w-80 border-r border-shark-800 bg-shark-900 flex flex-col flex-shrink-0 overflow-hidden">
            {/* Drawer Tabs: Files Changed vs Commits */}
            <div className="flex items-center border-b border-shark-800 bg-shark-950/60 p-1 gap-1">
              <button
                onClick={() => setActiveTab("files")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab === "files"
                    ? "bg-shark-800 text-sky-300 shadow-sm border border-shark-750"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Files</span>
                {comparison && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-shark-900 text-slate-400 font-mono">
                    {comparison.files.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("commits")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab === "commits"
                    ? "bg-shark-800 text-sky-300 shadow-sm border border-shark-750"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <GitCommit className="w-3.5 h-3.5" />
                <span>Commits</span>
                {comparison && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-shark-900 text-slate-400 font-mono">
                    {comparison.commits.length}
                  </span>
                )}
              </button>
            </div>

            {/* Search Input Filter */}
            <div className="p-2 border-b border-shark-800/80 bg-shark-900">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={activeTab === "files" ? "Filter changed files..." : "Filter commits..."}
                  className="w-full pl-8 pr-3 py-1 bg-shark-950 border border-shark-750 focus:border-sky-500 rounded text-xs font-mono text-slate-200 placeholder:text-slate-500 outline-none"
                />
              </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-shark-850/50">
              {isLoading ? (
                <div className="p-8 flex flex-col items-center justify-center text-slate-500 gap-2">
                  <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Comparing branches...</span>
                </div>
              ) : activeTab === "files" ? (
                filteredFiles.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs italic">
                    {searchQuery ? "No matching files" : "No files changed between these branches"}
                  </div>
                ) : (
                  filteredFiles.map((f) => {
                    const isSelected = selectedFilePath === f.path;
                    const pathParts = f.path.split("/");
                    const fileName = pathParts.pop() || f.path;
                    const dirPath = pathParts.join("/");

                    return (
                      <div
                        key={f.path}
                        onClick={() => {
                          setSelectedFilePath(f.path);
                          updateTab(tab.id, { prSelectedFile: f.path });
                        }}
                        className={`group flex items-center justify-between px-3 py-2 cursor-pointer transition-colors border-l-2 text-xs ${
                          isSelected
                            ? "bg-sky-500/10 border-sky-400 text-slate-100"
                            : "border-transparent hover:bg-shark-850/60 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate mr-2 min-w-0">
                          {getStatusBadge(f.status)}
                          <div className="truncate min-w-0">
                            {dirPath && (
                              <span className="text-slate-500 text-[10px] block truncate font-mono">
                                {dirPath}/
                              </span>
                            )}
                            <span className="font-mono text-xs font-medium block truncate">
                              {fileName}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 font-mono text-[10px] flex-shrink-0">
                          {f.additions > 0 && <span className="text-emerald-400">+{f.additions}</span>}
                          {f.deletions > 0 && <span className="text-rose-400">-{f.deletions}</span>}
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                filteredCommits.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs italic">
                    {searchQuery ? "No matching commits" : "No commits between these branches"}
                  </div>
                ) : (
                  filteredCommits.map((c) => (
                    <div
                      key={c.hash}
                      className="px-3 py-2 hover:bg-shark-850/60 transition-colors text-xs space-y-1 select-text"
                    >
                      <div className="font-semibold text-slate-200 line-clamp-2 leading-snug">
                        {c.summary}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span className="text-sky-400 font-semibold">{c.hash.slice(0, 7)}</span>
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[100px] text-slate-400">{c.author_name}</span>
                          <span className="text-slate-500">{formatTimestamp(c.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>

            {/* Overview Button at Drawer Bottom */}
            {selectedFilePath && (
              <div className="p-2 border-t border-shark-800 bg-shark-950">
                <button
                  onClick={() => {
                    setSelectedFilePath(null);
                    updateTab(tab.id, { prSelectedFile: null });
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-1 rounded bg-shark-850 hover:bg-shark-800 text-slate-300 border border-shark-750 text-xs transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>View PR Overview</span>
                </button>
              </div>
            )}
          </aside>

          {/* Right Main Pane: Diff Viewer or PR Overview Screen */}
          <main className="flex-1 flex flex-col min-w-0 bg-shark-950 overflow-hidden">
            {selectedFilePath ? (
              <DiffViewer
                diff={selectedFileDiff}
                filePath={selectedFilePath}
                readOnly={true}
                isLoading={isLoadingDiff}
                repoId={tab.repoId}
                tabId={tab.id}
              />
            ) : (
              /* PR Summary & Overview Screen */
              <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-start select-text">
                <div className="max-w-3xl w-full space-y-6">
                  {/* PR Header Banner */}
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-shark-900 to-shark-900/60 border border-shark-800/80 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold uppercase tracking-wider">
                        <GitPullRequest className="w-4 h-4" />
                        <span>Pull Request Preview</span>
                      </div>
                      {comparison && (
                        <div className="flex items-center gap-2 text-xs font-mono">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-semibold">
                            {comparison.ahead} commits
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800/60 font-semibold">
                            {comparison.files.length} files changed
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sky-300">{compareBranch}</span>
                        <ArrowRight className="w-4 h-4 text-slate-500" />
                        <span className="font-mono text-slate-300">{baseBranch}</span>
                      </h2>
                      <p className="text-xs text-slate-400">
                        Comparing all changes introduced in branch <code className="text-sky-300">{compareBranch}</code> relative to base branch <code className="text-slate-300">{baseBranch}</code>.
                      </p>
                    </div>

                    {/* Stats Grid */}
                    {comparison && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                        <div className="p-3 rounded-xl bg-shark-950/80 border border-shark-800">
                          <div className="text-[10px] text-slate-500 uppercase font-semibold">Commits</div>
                          <div className="text-lg font-bold font-mono text-sky-400 mt-0.5">
                            {comparison.commits.length}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-shark-950/80 border border-shark-800">
                          <div className="text-[10px] text-slate-500 uppercase font-semibold">Files Changed</div>
                          <div className="text-lg font-bold font-mono text-slate-200 mt-0.5">
                            {comparison.files.length}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-shark-950/80 border border-shark-800">
                          <div className="text-[10px] text-slate-500 uppercase font-semibold">Lines Added</div>
                          <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                            +{comparison.total_additions}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-shark-950/80 border border-shark-800">
                          <div className="text-[10px] text-slate-500 uppercase font-semibold">Lines Deleted</div>
                          <div className="text-lg font-bold font-mono text-rose-400 mt-0.5">
                            -{comparison.total_deletions}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 flex-wrap">
                      {comparison && comparison.files.length > 0 && (
                        <button
                          onClick={() => {
                            setSelectedFilePath(comparison.files[0].path);
                            updateTab(tab.id, { prSelectedFile: comparison.files[0].path });
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                          <span>Review First File ({comparison.files[0].path.split("/").pop()})</span>
                        </button>
                      )}

                      <button
                        onClick={handleCopySummary}
                        disabled={!comparison}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-shark-800 hover:bg-shark-750 text-slate-200 border border-shark-700 text-xs transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copy PR Summary</span>
                      </button>

                      <button
                        onClick={() => createPullRequestInBrowser(tab.id, compareBranch)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-shark-800 hover:bg-shark-750 text-slate-200 border border-shark-700 text-xs transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        <span>Open Compare on Web</span>
                      </button>
                    </div>
                  </div>

                  {/* Commits Section Preview */}
                  {comparison && comparison.commits.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <GitCommit className="w-3.5 h-3.5 text-sky-400" />
                          <span>Commits in this PR ({comparison.commits.length})</span>
                        </h3>
                        <button
                          onClick={() => setActiveTab("commits")}
                          className="text-xs text-sky-400 hover:underline flex items-center gap-0.5"
                        >
                          <span>View all</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="rounded-xl border border-shark-800 bg-shark-900 overflow-hidden divide-y divide-shark-850">
                        {comparison.commits.slice(0, 5).map((c) => (
                          <div key={c.hash} className="px-4 py-2.5 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 truncate mr-3">
                              <span className="font-mono text-sky-400 text-[11px] font-semibold flex-shrink-0">
                                {c.hash.slice(0, 7)}
                              </span>
                              <span className="text-slate-200 font-medium truncate">{c.summary}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono flex-shrink-0">
                              <span>{c.author_name}</span>
                              <span>•</span>
                              <span>{formatTimestamp(c.timestamp)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Changed Files Quick Links */}
                  {comparison && comparison.files.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <FileCode className="w-3.5 h-3.5 text-sky-400" />
                          <span>Files Changed ({comparison.files.length})</span>
                        </h3>
                        <button
                          onClick={() => setActiveTab("files")}
                          className="text-xs text-sky-400 hover:underline flex items-center gap-0.5"
                        >
                          <span>View all</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="rounded-xl border border-shark-800 bg-shark-900 overflow-hidden divide-y divide-shark-850">
                        {comparison.files.slice(0, 8).map((f) => (
                          <div
                            key={f.path}
                            onClick={() => {
                              setSelectedFilePath(f.path);
                              updateTab(tab.id, { prSelectedFile: f.path });
                            }}
                            className="px-4 py-2 flex items-center justify-between text-xs hover:bg-shark-850/60 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2 truncate mr-3">
                              {getStatusBadge(f.status)}
                              <span className="font-mono text-slate-300 truncate">{f.path}</span>
                            </div>
                            <div className="flex items-center gap-1 font-mono text-[11px] flex-shrink-0">
                              {f.additions > 0 && <span className="text-emerald-400">+{f.additions}</span>}
                              {f.deletions > 0 && <span className="text-rose-400">-{f.deletions}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
};
