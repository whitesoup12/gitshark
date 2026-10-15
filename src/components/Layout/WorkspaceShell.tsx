import React, { useEffect } from "react";
import { Tab } from "@/types";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { MainViewport } from "@/components/Viewport/MainViewport";
import { TerminalDrawer } from "@/components/Terminal/TerminalDrawer";
import { CollapsedHookIndicator } from "@/components/Terminal/CollapsedHookIndicator";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { AlertTriangle, Loader2 } from "lucide-react";

interface WorkspaceShellProps {
  tab: Tab;
}

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({ tab }) => {
  const {
    toggleTerminal,
    toggleSidebar,
    closeTab,
    openRepositoryTab,
    openRepoInBrowser,
    createPullRequestInBrowser,
  } = useWorkspaceStore();

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle terminal: Ctrl+` or Cmd+`
      if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        toggleTerminal(tab.id);
        return;
      }

      // Ignore text entry fields
      const target = e.target as HTMLElement | null;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if (isInput) return;

      // Open repo in browser: Ctrl+Shift+B or Cmd+Shift+B
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        openRepoInBrowser(tab.id);
      }
      // Create Pull Request in browser: Ctrl+Shift+P or Cmd+Shift+P
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        createPullRequestInBrowser(tab.id);
      }
      // Toggle sidebar: Ctrl+B or Cmd+B
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b" && !e.shiftKey) {
        e.preventDefault();
        toggleSidebar(tab.id);
      }
      // Close tab: Ctrl+W
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w" && !e.shiftKey) {
        e.preventDefault();
        closeTab(tab.id);
      }
      // Open repo: Ctrl+O
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o" && !e.shiftKey) {
        e.preventDefault();
        openRepositoryTab();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    tab.id,
    toggleTerminal,
    toggleSidebar,
    closeTab,
    openRepositoryTab,
    openRepoInBrowser,
    createPullRequestInBrowser,
  ]);

  if (tab.isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-shark-950 text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        <div className="text-xs font-medium">Opening repository at {tab.path}...</div>
      </div>
    );
  }

  if (tab.error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-shark-950 p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-950/60 border border-red-800/80 flex items-center justify-center text-red-400 mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-200 mb-1">
          Failed to Open Repository
        </h3>
        <p className="text-xs text-red-400 max-w-md font-mono bg-shark-900 p-3 rounded-lg border border-shark-800 mb-4">
          {tab.error}
        </p>
        <button
          onClick={() => closeTab(tab.id)}
          className="px-4 py-1.5 rounded-md bg-shark-800 hover:bg-shark-750 text-xs text-slate-200 transition-colors"
        >
          Dismiss Tab
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Horizontal split: Left Sidebar & Center Viewport */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar tab={tab} />
        <MainViewport tab={tab} />
      </div>

      {/* Collapsible Bottom PTY Terminal Drawer */}
      {tab.terminalOpen && (
        <TerminalDrawer
          tab={tab}
          onClose={() => toggleTerminal(tab.id)}
        />
      )}

      {/* Subtle indicator when drawer is collapsed */}
      <CollapsedHookIndicator tab={tab} />
    </div>
  );
};
