import React from "react";
import {
  Code,
  FolderPlus,
  FilePlus,
  Save,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
} from "lucide-react";
import { useCodeSharkStore } from "../store/useCodeSharkStore";
import { pickDirectory, pickFile } from "@/lib/ipc";

export const CodeSharkHeader: React.FC = () => {
  const {
    sidebarOpen,
    toggleSidebar,
    addProjectFolder,
    openTarget,
    saveFile,
    openTabs,
    activeFilePath,
    isSaving,
    projects,
  } = useCodeSharkStore();

  const activeTab = openTabs.find((t) => t.path === activeFilePath);
  const activeProject = projects.find((p) => p.id === activeTab?.projectId);

  const handlePickDirectory = async () => {
    const dir = await pickDirectory("Add Folder to CodeShark Workspace");
    if (dir) {
      await addProjectFolder(dir);
    }
  };

  const handlePickFile = async () => {
    const file = await pickFile("Open File in CodeShark");
    if (file) {
      await openTarget(file);
    }
  };

  return (
    <header className="flex items-center justify-between h-10 px-3 bg-shark-900 border-b border-shark-800 text-shark-200 select-none">
      {/* Left: Sidebar toggle & CodeShark Branding */}
      <div className="flex items-center space-x-2">
        <button
          onClick={toggleSidebar}
          title={sidebarOpen ? "Collapse Sidebar (Ctrl+B)" : "Expand Sidebar (Ctrl+B)"}
          className="p-1.5 rounded hover:bg-shark-800 text-shark-400 hover:text-shark-100 transition-colors"
        >
          {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>

        <div className="flex items-center space-x-1.5 font-semibold text-sm text-cyan-400 tracking-wide">
          <Code className="w-4 h-4 text-cyan-400" />
          <span>CodeShark</span>
          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50">
            IDE
          </span>
        </div>

        {/* Breadcrumb Path */}
        {(activeProject || activeTab) && (
          <div className="hidden sm:flex items-center space-x-1 text-xs text-shark-400 pl-3 border-l border-shark-800">
            {activeProject && (
              <>
                <span className="text-shark-300 font-medium">{activeProject.name}</span>
                <ChevronRight className="w-3 h-3 text-shark-500" />
              </>
            )}
            {activeTab && (
              <span className="text-shark-200 font-mono">
                {activeTab.name}
                {activeTab.isDirty && <span className="ml-1 text-amber-400 font-bold">•</span>}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-1.5">
        <button
          onClick={handlePickDirectory}
          title="Add Folder to Workspace"
          className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded bg-shark-800/80 hover:bg-shark-700/80 text-shark-200 hover:text-white transition-colors border border-shark-700/40"
        >
          <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden md:inline">Add Folder</span>
        </button>

        <button
          onClick={handlePickFile}
          title="Open File"
          className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded bg-shark-800/80 hover:bg-shark-700/80 text-shark-200 hover:text-white transition-colors border border-shark-700/40"
        >
          <FilePlus className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden md:inline">Open File</span>
        </button>

        {activeTab && (
          <button
            onClick={() => saveFile()}
            disabled={!activeTab.isDirty || isSaving}
            title="Save Active File (Ctrl+S)"
            className={`flex items-center space-x-1 px-2.5 py-1 text-xs rounded transition-colors border ${
              activeTab.isDirty
                ? "bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400 shadow-sm"
                : "bg-shark-800/50 text-shark-500 border-transparent cursor-default"
            }`}
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? "animate-spin" : ""}`} />
            <span>Save</span>
          </button>
        )}
      </div>
    </header>
  );
};
