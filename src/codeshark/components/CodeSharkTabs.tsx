import React, { useState, useEffect } from "react";
import {
  X,
  FileCode,
  Save,
  XCircle,
  ArrowRightToLine,
  Trash2,
  Copy,
  Files,
} from "lucide-react";
import { useCodeSharkStore } from "../store/useCodeSharkStore";
import { normalizePath } from "../utils/language";
import type { OpenFileTab } from "@/types";

interface TabContextMenuState {
  tab: OpenFileTab;
  x: number;
  y: number;
}

export const CodeSharkTabs: React.FC = () => {
  const {
    openTabs,
    activeFilePath,
    openFile,
    closeTab,
    closeOtherTabs,
    closeTabsToTheRight,
    closeAllTabs,
    saveFile,
    setStatusMessage,
    projects,
    projectGitStatus,
  } = useCodeSharkStore();

  const [contextMenu, setContextMenu] = useState<TabContextMenuState | null>(null);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleOutsideClick = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };

    window.addEventListener("click", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (openTabs.length === 0) {
    return null;
  }

  return (
    <>
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
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({
                  tab,
                  x: Math.min(e.clientX, window.innerWidth - 210),
                  y: e.clientY + 4,
                });
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

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 min-w-[190px] py-1 bg-shark-950 border border-shark-750 rounded-lg shadow-2xl text-xs text-slate-200 select-none font-sans"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Save */}
          <button
            onClick={() => {
              saveFile(contextMenu.tab.path);
              setContextMenu(null);
            }}
            disabled={!contextMenu.tab.isDirty}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-shark-850 disabled:opacity-40 disabled:hover:bg-transparent text-left transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Save className="w-3.5 h-3.5 text-cyan-400" />
              <span>Save</span>
            </div>
            <span className="text-[10px] text-shark-500 font-mono">Ctrl+S</span>
          </button>

          {/* Close */}
          <button
            onClick={() => {
              closeTab(contextMenu.tab.path);
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-shark-850 text-left transition-colors"
          >
            <div className="flex items-center space-x-2">
              <X className="w-3.5 h-3.5 text-shark-400" />
              <span>Close</span>
            </div>
            <span className="text-[10px] text-shark-500 font-mono">Ctrl+W</span>
          </button>

          {/* Close Others */}
          <button
            onClick={() => {
              closeOtherTabs(contextMenu.tab.path);
              setContextMenu(null);
            }}
            disabled={openTabs.length <= 1}
            className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-shark-850 disabled:opacity-40 disabled:hover:bg-transparent text-left transition-colors"
          >
            <XCircle className="w-3.5 h-3.5 text-shark-400" />
            <span>Close Others</span>
          </button>

          {/* Close to the Right */}
          <button
            onClick={() => {
              closeTabsToTheRight(contextMenu.tab.path);
              setContextMenu(null);
            }}
            disabled={openTabs[openTabs.length - 1].path === contextMenu.tab.path}
            className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-shark-850 disabled:opacity-40 disabled:hover:bg-transparent text-left transition-colors"
          >
            <ArrowRightToLine className="w-3.5 h-3.5 text-shark-400" />
            <span>Close to the Right</span>
          </button>

          {/* Close All */}
          <button
            onClick={() => {
              closeAllTabs();
              setContextMenu(null);
            }}
            className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-shark-850 text-left transition-colors text-red-300 hover:text-red-200"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>Close All</span>
          </button>

          <div className="border-t border-shark-800 my-1" />

          {/* Copy Path */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.tab.path);
              setStatusMessage("Copied full path to clipboard");
              setContextMenu(null);
            }}
            className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-shark-850 text-left transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-shark-400" />
            <span>Copy Path</span>
          </button>

          {/* Copy Relative Path */}
          <button
            onClick={() => {
              const project = projects.find((p) => p.id === contextMenu.tab.projectId);
              let rel = contextMenu.tab.path;
              if (project) {
                const normProj = project.path.replace(/[/\\]+$/, "");
                if (rel.toLowerCase().startsWith(normProj.toLowerCase())) {
                  rel = rel.slice(normProj.length).replace(/^[/\\]+/, "");
                }
              }
              navigator.clipboard.writeText(rel);
              setStatusMessage("Copied relative path to clipboard");
              setContextMenu(null);
            }}
            className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-shark-850 text-left transition-colors"
          >
            <Files className="w-3.5 h-3.5 text-shark-400" />
            <span>Copy Relative Path</span>
          </button>
        </div>
      )}
    </>
  );
};
