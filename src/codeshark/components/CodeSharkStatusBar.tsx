import React from "react";
import { CheckCircle2, AlertCircle, FileCode, GitBranch, Sparkles } from "lucide-react";
import { useCodeSharkStore } from "../store/useCodeSharkStore";
import { normalizePath } from "../utils/language";

export const CodeSharkStatusBar: React.FC = () => {
  const {
    openTabs,
    activeFilePath,
    cursorPos,
    statusMessage,
    isSaving,
    projects,
    projectGitStatus,
    quietLinting,
    toggleQuietLinting,
  } = useCodeSharkStore();

  const activeTab = openTabs.find((t) => t.path === activeFilePath);
  const activeProject = projects.find((p) => p.id === activeTab?.projectId);

  let activeGitStatus: string | undefined;
  if (activeProject && activeTab) {
    const gitMap = projectGitStatus[activeProject.id] || {};
    const normFile = normalizePath(activeTab.path);
    const normProj = normalizePath(activeProject.path);
    if (normFile.toLowerCase().startsWith(normProj.toLowerCase())) {
      const rel = normFile.slice(normProj.length).replace(/^[/\\]+/, "").toLowerCase();
      activeGitStatus = gitMap[rel];
    }
  }

  return (
    <footer className="flex items-center justify-between h-6 px-3 bg-cyan-950 border-t border-cyan-900/60 text-shark-300 text-[11px] select-none shrink-0 font-mono">
      {/* Left Status */}
      <div className="flex items-center space-x-3 truncate">
        {statusMessage ? (
          <span className="flex items-center space-x-1 text-cyan-200">
            {statusMessage.startsWith("Error") ? (
              <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0" />
            )}
            <span className="truncate">{statusMessage}</span>
          </span>
        ) : isSaving ? (
          <span className="text-cyan-300 animate-pulse">Saving...</span>
        ) : activeProject ? (
          <span className="flex items-center space-x-1 text-shark-300 truncate">
            <GitBranch className="w-3 h-3 text-cyan-400" />
            <span className="truncate">{activeProject.name}</span>
          </span>
        ) : (
          <span className="text-shark-400">Ready</span>
        )}

        {/* Active file Git status badge */}
        {activeGitStatus && (
          <span
            className={`px-1.5 py-0.2 rounded font-sans text-[10px] font-semibold border ${
              activeGitStatus === "modified"
                ? "bg-amber-950/60 text-amber-300 border-amber-800/60"
                : activeGitStatus === "untracked" || activeGitStatus === "new"
                ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
                : "bg-cyan-950/60 text-cyan-300 border-cyan-800/60"
            }`}
          >
            Git: {activeGitStatus}
          </span>
        )}
      </div>

      {/* Right Details */}
      <div className="flex items-center space-x-3 text-shark-400">
        {/* Linting mode toggle */}
        <button
          onClick={toggleQuietLinting}
          className={`flex items-center space-x-1 px-1.5 py-0.2 rounded transition-colors text-[10px] font-sans ${
            quietLinting
              ? "bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-800/50"
              : "bg-cyan-900/60 text-cyan-200 hover:bg-cyan-800/60 border border-cyan-700/50"
          }`}
          title={
            quietLinting
              ? "Linting Clean: All squigglies and linting lines are removed. Click to enable linting."
              : "Linting Active: Diagnostics and squigglies enabled. Click to silence."
          }
        >
          <Sparkles className="w-2.5 h-2.5" />
          <span>{quietLinting ? "Lint: Clean" : "Lint: Active"}</span>
        </button>

        {activeTab && (
          <>
            <span>
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
            <span>Spaces: 2</span>
            <span>UTF-8</span>
            <span className="capitalize text-cyan-300 font-sans flex items-center space-x-1">
              <FileCode className="w-3 h-3" />
              <span>{activeTab.language}</span>
            </span>
          </>
        )}
      </div>
    </footer>
  );
};
