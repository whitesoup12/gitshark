import React, { useState, useEffect } from "react";
import {
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  X,
  RefreshCw,
  Files,
  FileCode,
  Search,
} from "lucide-react";
import { useCodeSharkStore } from "../store/useCodeSharkStore";
import { FileTreeItem } from "./FileTreeItem";
import { CodeSharkSearchPanel } from "./CodeSharkSearchPanel";
import {
  CodeSharkFileContextMenu,
  type FileContextMenuTarget,
} from "./CodeSharkFileContextMenu";
import { normalizePath } from "../utils/language";
import { pickDirectory } from "@/lib/ipc";

export const CodeSharkSidebar: React.FC = () => {
  const {
    projects,
    removeProject,
    treeNodes,
    loadFolderEntries,
    expandedFolders,
    toggleFolder,
    openTabs,
    activeFilePath,
    openFile,
    closeTab,
    addProjectFolder,
    sidebarWidth,
    setSidebarWidth,
    projectGitStatus,
    refreshGitStatus,
    sidebarTab,
    setSidebarTab,
    searchResults,
  } = useCodeSharkStore();

  const [isResizing, setIsResizing] = useState(false);
  const [fileContextMenu, setFileContextMenu] = useState<{
    target: FileContextMenuTarget;
    x: number;
    y: number;
  } | null>(null);

  // Refresh git status on mount
  useEffect(() => {
    if (projects.length > 0) {
      refreshGitStatus();
    }
  }, [projects.length, refreshGitStatus]);

  // Handle drag resizing of sidebar
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      setSidebarWidth(e.clientX);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  const handleAddFolder = async () => {
    const dir = await pickDirectory("Add Folder to CodeShark Workspace");
    if (dir) {
      await addProjectFolder(dir);
    }
  };

  const handleItemContextMenu = (
    target: FileContextMenuTarget,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setFileContextMenu({
      target,
      x: e.clientX,
      y: e.clientY,
    });
  };

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className="relative h-full bg-shark-950/95 border-r border-shark-800 flex flex-col shrink-0 select-none overflow-hidden"
    >
      {/* Sidebar Header & Tab Switcher */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-shark-800 bg-shark-900/50">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setSidebarTab("files")}
            title="Files Explorer"
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold tracking-wide transition-colors ${
              sidebarTab === "files"
                ? "bg-cyan-950 text-cyan-300 border border-cyan-800/60 shadow-sm"
                : "text-shark-400 hover:text-shark-200 hover:bg-shark-800/50"
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Files</span>
          </button>

          <button
            onClick={() => setSidebarTab("search")}
            title="Search in Workspace (Ctrl+Shift+F)"
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold tracking-wide transition-colors ${
              sidebarTab === "search"
                ? "bg-cyan-950 text-cyan-300 border border-cyan-800/60 shadow-sm"
                : "text-shark-400 hover:text-shark-200 hover:bg-shark-800/50"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
            {searchResults.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-900 text-[10px] text-cyan-200 font-bold">
                {searchResults.length}
              </span>
            )}
          </button>
        </div>

        {sidebarTab === "files" && (
          <button
            onClick={handleAddFolder}
            title="Add Folder to Workspace"
            className="p-1 rounded hover:bg-shark-800 text-shark-400 hover:text-cyan-400 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main View: Search Panel vs Files Tree */}
      {sidebarTab === "search" ? (
        <div className="flex-1 overflow-hidden">
          <CodeSharkSearchPanel />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Open Editors Section */}
          {openTabs.length > 0 && (
            <div className="border-b border-shark-800/80 mb-1">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-shark-400 tracking-wider flex items-center space-x-1">
                <Files className="w-3 h-3 text-cyan-400" />
                <span>Open Editors</span>
              </div>
              <div className="space-y-0.5 pb-1">
                {openTabs.map((tab) => {
                  const isActive = activeFilePath
                    ? normalizePath(activeFilePath) === normalizePath(tab.path)
                    : false;

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
                      key={tab.id || tab.path}
                      onClick={() => openFile(tab.path, tab.name, tab.projectId)}
                      onContextMenu={(e) =>
                        handleItemContextMenu(
                          {
                            path: tab.path,
                            name: tab.name,
                            isDir: false,
                            projectId: tab.projectId,
                          },
                          e
                        )
                      }
                      className={`group flex items-center justify-between px-3 py-1 text-xs cursor-pointer transition-colors ${
                        isActive
                          ? "bg-cyan-950/60 text-cyan-200 font-medium"
                          : "text-shark-300 hover:bg-shark-800/40 hover:text-shark-100"
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 truncate">
                        <FileCode className="w-3.5 h-3.5 text-shark-400 shrink-0" />
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
                        {tab.isDirty && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        {tabGitStatus && (
                          <span
                            className={`text-[10px] font-bold ${
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(tab.id || tab.path);
                          }}
                          title="Close"
                          className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-shark-700/60 text-shark-400 hover:text-shark-200 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Multi-Root Projects Section */}
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center text-shark-400 space-y-3">
              <Folder className="w-8 h-8 text-shark-500 opacity-60" />
              <div className="text-xs">No project folders open in CodeShark</div>
              <button
                onClick={handleAddFolder}
                className="px-3 py-1.5 text-xs rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/30 transition-colors"
              >
                Add Folder...
              </button>
            </div>
          ) : (
            <div className="py-1">
              {projects.map((project) => {
                const normProj = normalizePath(project.path);
                const isExpanded = expandedFolders[normProj] ?? true;
                const entries = treeNodes[normProj] || [];

                return (
                  <div key={project.id} className="mb-2">
                    {/* Project Root Header */}
                    <div
                      onClick={() => toggleFolder(project.path)}
                      onContextMenu={(e) =>
                        handleItemContextMenu(
                          {
                            path: project.path,
                            name: project.name,
                            isDir: true,
                            isProjectRoot: true,
                            projectId: project.id,
                          },
                          e
                        )
                      }
                      className="group flex items-center justify-between px-2.5 py-1.5 hover:bg-shark-800/50 cursor-pointer text-xs font-semibold text-shark-200 tracking-wide"
                    >
                      <div className="flex items-center space-x-1.5 truncate">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-shark-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-shark-400 shrink-0" />
                        )}
                        {isExpanded ? (
                          <FolderOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        ) : (
                          <Folder className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                        )}
                        <span className="truncate">{project.name}</span>
                      </div>

                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            loadFolderEntries(project.path);
                            refreshGitStatus(project.id);
                          }}
                          title="Refresh Folder & Git Status"
                          className="p-1 rounded hover:bg-shark-700 text-shark-400 hover:text-shark-200"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeProject(project.id);
                          }}
                          title="Remove from Workspace"
                          className="p-1 rounded hover:bg-shark-700 text-shark-400 hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Project Files */}
                    {isExpanded && (
                      <div className="mt-0.5">
                        {entries.length > 0 ? (
                          entries.map((child) => (
                            <FileTreeItem
                              key={child.path}
                              node={child}
                              depth={0}
                              projectId={project.id}
                              onContextMenu={handleItemContextMenu}
                            />
                          ))
                        ) : (
                          <div className="pl-6 py-1 text-[11px] text-shark-500 italic">
                            (loading or empty)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Right click file/dir context menu */}
      {fileContextMenu && (
        <CodeSharkFileContextMenu
          target={fileContextMenu.target}
          x={fileContextMenu.x}
          y={fileContextMenu.y}
          onClose={() => setFileContextMenu(null)}
        />
      )}

      {/* Draggable Resize Divider */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        title="Drag to resize sidebar"
        className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:w-1.5 hover:bg-cyan-500/70 transition-all z-20 ${
          isResizing ? "w-1.5 bg-cyan-500 shadow-md shadow-cyan-500/50" : "bg-transparent"
        }`}
      />
    </aside>
  );
};
