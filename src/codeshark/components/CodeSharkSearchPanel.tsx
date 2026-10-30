import React, { useState, useMemo } from "react";
import {
  Search,
  Replace,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  X,
  FileCode,
  CaseSensitive,
  WholeWord,
  Regex,
  Filter,
  Loader2,
} from "lucide-react";
import { useCodeSharkStore } from "../store/useCodeSharkStore";
import type { WorkspaceContentMatch } from "@/types";

export const CodeSharkSearchPanel: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    replaceQuery,
    setReplaceQuery,
    isReplaceOpen,
    toggleReplaceOpen,
    searchCaseSensitive,
    toggleSearchCaseSensitive,
    searchWholeWord,
    toggleSearchWholeWord,
    searchIsRegex,
    toggleSearchIsRegex,
    searchIncludePattern,
    setSearchIncludePattern,
    searchExcludePattern,
    setSearchExcludePattern,
    searchResults,
    isSearching,
    searchSummary,
    executeGlobalSearch,
    clearGlobalSearch,
    executeGlobalReplace,
    replaceSingleMatch,
    openFile,
    setJumpToLocation,
  } = useCodeSharkStore();

  const [showFilters, setShowFilters] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});
  const [confirmReplaceAll, setConfirmReplaceAll] = useState(false);

  // Group search results by file
  const groupedResults = useMemo(() => {
    const map = new Map<string, { fileName: string; relativePath: string; matches: WorkspaceContentMatch[] }>();
    for (const match of searchResults) {
      if (!map.has(match.file_path)) {
        map.set(match.file_path, {
          fileName: match.file_name,
          relativePath: match.relative_path,
          matches: [],
        });
      }
      map.get(match.file_path)!.matches.push(match);
    }
    return Array.from(map.entries()).map(([filePath, data]) => ({
      filePath,
      fileName: data.fileName,
      relativePath: data.relativePath,
      matches: data.matches,
    }));
  }, [searchResults]);

  const toggleFileCollapse = (filePath: string) => {
    setCollapsedFiles((prev) => ({
      ...prev,
      [filePath]: !prev[filePath],
    }));
  };

  const handleKeyDownSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeGlobalSearch();
    }
  };

  const handleMatchClick = async (match: WorkspaceContentMatch) => {
    await openFile(match.file_path, match.file_name);
    setJumpToLocation({
      filePath: match.file_path,
      line: match.line_number,
      col: match.match_start + 1,
      endCol: match.match_end + 1,
    });
  };

  return (
    <div className="flex flex-col h-full bg-shark-950 text-shark-200 select-none text-xs">
      {/* Search Header Inputs */}
      <div className="p-2.5 border-b border-shark-800 space-y-2">
        {/* Find Row */}
        <div className="flex items-center space-x-1">
          <button
            onClick={toggleReplaceOpen}
            title={isReplaceOpen ? "Hide Replace" : "Show Replace"}
            className="p-1 rounded hover:bg-shark-800 text-shark-400 hover:text-shark-200 transition-colors shrink-0"
          >
            {isReplaceOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          <div className="relative flex-1 flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDownSearch}
              placeholder="Search in workspace..."
              className="w-full bg-shark-900 border border-shark-700 rounded pl-2.5 pr-20 py-1 text-xs text-white placeholder-shark-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
            {searchQuery && (
              <button
                onClick={clearGlobalSearch}
                className="absolute right-14 text-shark-400 hover:text-white p-0.5"
                title="Clear"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Search options toggles */}
            <div className="absolute right-1.5 flex items-center space-x-0.5 text-shark-400">
              <button
                type="button"
                onClick={toggleSearchCaseSensitive}
                title="Match Case (Alt+C)"
                className={`p-1 rounded hover:bg-shark-800 transition-colors ${
                  searchCaseSensitive ? "bg-cyan-950 text-cyan-400 font-bold border border-cyan-800" : ""
                }`}
              >
                <CaseSensitive className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={toggleSearchWholeWord}
                title="Match Whole Word (Alt+W)"
                className={`p-1 rounded hover:bg-shark-800 transition-colors ${
                  searchWholeWord ? "bg-cyan-950 text-cyan-400 font-bold border border-cyan-800" : ""
                }`}
              >
                <WholeWord className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={toggleSearchIsRegex}
                title="Use Regular Expression (Alt+R)"
                className={`p-1 rounded hover:bg-shark-800 transition-colors ${
                  searchIsRegex ? "bg-cyan-950 text-cyan-400 font-bold border border-cyan-800" : ""
                }`}
              >
                <Regex className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <button
            onClick={executeGlobalSearch}
            disabled={isSearching || !searchQuery.trim()}
            title="Search"
            className="p-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white transition-colors shrink-0"
          >
            {isSearching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Replace Row (if toggled) */}
        {isReplaceOpen && (
          <div className="flex items-center space-x-1 pl-4">
            <input
              type="text"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="Replace with..."
              className="flex-1 bg-shark-900 border border-shark-700 rounded px-2.5 py-1 text-xs text-white placeholder-shark-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <button
              onClick={() => setConfirmReplaceAll(true)}
              disabled={isSearching || !searchQuery || searchResults.length === 0}
              title="Replace All across Workspace"
              className="flex items-center space-x-1 px-2 py-1 rounded bg-amber-600/80 hover:bg-amber-600 disabled:opacity-40 text-white font-medium transition-colors shrink-0 text-[11px]"
            >
              <Replace className="w-3 h-3" />
              <span>Replace All</span>
            </button>
          </div>
        )}

        {/* Filter Toggle */}
        <div className="flex items-center justify-between text-[11px] text-shark-400 pt-0.5">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-1 hover:text-shark-200 transition-colors"
          >
            <Filter className="w-3 h-3 text-cyan-400" />
            <span>{showFilters ? "Hide include/exclude filters" : "Files to include / exclude"}</span>
          </button>
          {searchResults.length > 0 && (
            <button
              onClick={() => {
                const allCollapsed = groupedResults.every((g) => collapsedFiles[g.filePath]);
                const next: Record<string, boolean> = {};
                for (const g of groupedResults) {
                  next[g.filePath] = !allCollapsed;
                }
                setCollapsedFiles(next);
              }}
              className="hover:text-shark-200 transition-colors"
            >
              Toggle All
            </button>
          )}
        </div>

        {/* Files to Include / Exclude Inputs */}
        {showFilters && (
          <div className="space-y-1.5 pt-1 border-t border-shark-800/80">
            <div>
              <span className="text-[10px] uppercase font-semibold text-shark-400">files to include</span>
              <input
                type="text"
                value={searchIncludePattern}
                onChange={(e) => setSearchIncludePattern(e.target.value)}
                placeholder="e.g. *.ts, src/**"
                className="w-full mt-0.5 bg-shark-900 border border-shark-800 rounded px-2 py-0.5 text-[11px] text-white placeholder-shark-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-shark-400">files to exclude</span>
              <input
                type="text"
                value={searchExcludePattern}
                onChange={(e) => setSearchExcludePattern(e.target.value)}
                placeholder="e.g. *.test.ts, dist"
                className="w-full mt-0.5 bg-shark-900 border border-shark-800 rounded px-2 py-0.5 text-[11px] text-white placeholder-shark-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* Search Results Summary */}
      {searchSummary && (
        <div className="px-3 py-1.5 bg-shark-900/60 border-b border-shark-800 text-[11px] text-shark-400 flex items-center justify-between">
          <span>
            {searchSummary.matchCount} result{searchSummary.matchCount === 1 ? "" : "s"} in{" "}
            {searchSummary.filesCount} file{searchSummary.filesCount === 1 ? "" : "s"}
          </span>
          <button
            onClick={executeGlobalSearch}
            title="Refresh search"
            className="p-1 rounded hover:bg-shark-800 text-shark-400 hover:text-shark-200"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Results Tree Body */}
      <div className="flex-1 overflow-y-auto py-1">
        {isSearching ? (
          <div className="flex flex-col items-center justify-center h-40 text-shark-400 space-y-2">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            <span className="text-xs">Searching workspace files...</span>
          </div>
        ) : groupedResults.length > 0 ? (
          groupedResults.map((group) => {
            const isCollapsed = !!collapsedFiles[group.filePath];
            const dirOnly = group.relativePath.includes("/")
              ? group.relativePath.slice(0, group.relativePath.lastIndexOf("/"))
              : "";

            return (
              <div key={group.filePath} className="mb-1">
                {/* File Header */}
                <div
                  onClick={() => toggleFileCollapse(group.filePath)}
                  className="group flex items-center justify-between px-2.5 py-1 hover:bg-shark-850 cursor-pointer text-shark-200 font-medium"
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-shark-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-shark-400 shrink-0" />
                    )}
                    <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-white truncate">{group.fileName}</span>
                    {dirOnly && (
                      <span className="text-[11px] text-shark-500 truncate">{dirOnly}</span>
                    )}
                  </div>
                  <span className="px-1.5 py-0.2 rounded-full bg-shark-800 text-[10px] text-shark-300 font-bold shrink-0 ml-1">
                    {group.matches.length}
                  </span>
                </div>

                {/* Match Lines */}
                {!isCollapsed && (
                  <div className="pl-6 space-y-0.5">
                    {group.matches.map((match, idx) => (
                      <div
                        key={`${match.file_path}_${match.line_number}_${idx}`}
                        onClick={() => handleMatchClick(match)}
                        className="group flex items-center justify-between pr-2 py-0.5 hover:bg-cyan-950/40 cursor-pointer rounded transition-colors text-[11px]"
                      >
                        <div className="flex items-baseline space-x-1.5 truncate">
                          <span className="font-mono text-shark-500 w-8 text-right shrink-0">
                            {match.line_number}
                          </span>
                          <span className="font-mono text-shark-300 truncate">
                            {match.line_content}
                          </span>
                        </div>

                        {/* Replace this single match button */}
                        {isReplaceOpen && replaceQuery !== undefined && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              replaceSingleMatch(match);
                            }}
                            title={`Replace with "${replaceQuery}"`}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-amber-600/80 text-shark-300 hover:text-white transition-opacity ml-2 shrink-0"
                          >
                            <Replace className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : searchSummary && searchSummary.matchCount === 0 ? (
          <div className="p-6 text-center text-shark-400">
            <p className="text-xs">No results found for &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          <div className="p-6 text-center text-shark-500">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Type a search query and press Enter</p>
          </div>
        )}
      </div>

      {/* Confirm Replace All Modal */}
      {confirmReplaceAll && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-lg bg-shark-900 border border-shark-700 p-4 shadow-2xl text-shark-100 select-none">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center space-x-2">
              <Replace className="w-4 h-4 text-amber-400" />
              <span>Confirm Global Replace</span>
            </h3>
            <p className="text-xs text-shark-300 mb-3">
              Replace all {searchResults.length} occurrences across{" "}
              {groupedResults.length} files with:
            </p>
            <div className="bg-shark-950 border border-shark-800 rounded p-2 text-xs font-mono text-cyan-300 mb-4 truncate">
              &quot;{replaceQuery}&quot;
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setConfirmReplaceAll(false)}
                className="px-3 py-1.5 text-xs rounded bg-shark-800 hover:bg-shark-700 text-shark-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setConfirmReplaceAll(false);
                  await executeGlobalReplace();
                }}
                className="px-3 py-1.5 text-xs rounded bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors shadow"
              >
                Replace All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
