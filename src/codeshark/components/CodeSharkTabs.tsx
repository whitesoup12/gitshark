import React from "react";
import { X, FileCode } from "lucide-react";
import { useCodeSharkStore } from "../store/useCodeSharkStore";
import { normalizePath } from "../utils/language";

export const CodeSharkTabs: React.FC = () => {
  const {
    openTabs,
    activeFilePath,
    openFile,
    closeTab,
    projects,
    projectGitStatus,
  } = useCodeSharkStore();

  if (openTabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center h-9 bg-shark-900 border-b border-shark-800 overflow-x-auto no-scrollbar select-none shrink-0">
      {openTabs.map((tab) => {
        const isActive = activeFilePath
          ? normalizePath(activeFilePath) === normalizePath(tab.path)
          : false;

        // Lookup Git status for this tab
        const project = projects.find((p) => p.id === tab.projectId);
        const gitStatusMap = (project && projectGitStatus[project.id]) || {};
        let tabGitStatus: string | undefined;

        if (project) {
          const normFile = normalizePath(tab.path);
          const normProj = normalizePath(project.path);
          if (normFile.toLowerCase().startsWith(normProj.toLowerCase())) {
            const rel = normFile.slice(normProj.length).replace(/^[/\\]+/, "").toLowerCase();
            tabGitStatus = gitStatusMap[rel];
          }
        }

        return (
          <div
            key={tab.path}
            onClick={() => openFile(tab.path, tab.name, tab.projectId)}
            onMouseDown={(e) => {
              if (e.button === 1) {
                // Middle click closes tab
                e.preventDefault();
                closeTab(tab.path);
              }
            }}
            title={tab.path}
            className={`group flex items-center h-full px-3 text-xs border-r border-shark-800 cursor-pointer space-x-2 transition-colors shrink-0 max-w-[200px] ${
              isActive
                ? "bg-shark-950 text-cyan-200 border-t-2 border-t-cyan-400 font-medium"
                : "bg-shark-900 text-shark-400 hover:bg-shark-850 hover:text-shark-200"
            }`}
          >
            <FileCode
              className={`w-3.5 h-3.5 shrink-0 ${
                tabGitStatus === "modified"
                  ? "text-amber-400"
                  : tabGitStatus === "untracked" || tabGitStatus === "new"
                  ? "text-emerald-400"
                  : isActive
                  ? "text-cyan-400"
                  : "text-shark-500"
              }`}
            />
            <span
              className={`truncate ${
                tabGitStatus === "modified"
                  ? "text-amber-400"
                  : tabGitStatus === "untracked" || tabGitStatus === "new"
                  ? "text-emerald-400"
                  : tabGitStatus === "staged"
                  ? "text-cyan-400"
                  : ""
              }`}
            >
              {tab.name}
            </span>

            {/* Git status label if modified */}
            {tabGitStatus && !tab.isDirty && (
              <span
                className={`text-[9px] font-bold ${
                  tabGitStatus === "modified"
                    ? "text-amber-400"
                    : tabGitStatus === "untracked" || tabGitStatus === "new"
                    ? "text-emerald-400"
                    : "text-cyan-400"
                }`}
              >
                {tabGitStatus === "modified"
                  ? "M"
                  : tabGitStatus === "untracked" || tabGitStatus === "new"
                  ? "U"
                  : "S"}
              </span>
            )}

            {/* Dirty indicator or close button */}
            <div className="flex items-center shrink-0">
              {tab.isDirty ? (
                <span
                  title="Unsaved changes"
                  className="w-2 h-2 rounded-full bg-amber-400 group-hover:hidden"
                />
              ) : null}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.path);
                }}
                title="Close Tab (Ctrl+W)"
                className={`p-0.5 rounded hover:bg-shark-700/60 text-shark-400 hover:text-white transition-opacity ${
                  tab.isDirty ? "hidden group-hover:block" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
