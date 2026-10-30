import React, { useEffect } from "react";
import { Tab } from "@/types";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { MainViewport } from "@/components/Viewport/MainViewport";
import { TerminalDrawer } from "@/components/Terminal/TerminalDrawer";
import { CollapsedHookIndicator } from "@/components/Terminal/CollapsedHookIndicator";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { AlertTriangle, Loader2, Terminal as TerminalIcon } from "lucide-react";

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

      {/* Bottom-Right Floating Terminal Toggle Dock */}
      <div className="absolute bottom-3 right-4 z-30 flex items-center gap-2 pointer-events-auto select-none">
        <CollapsedHookIndicator tab={tab} />
        <button
          onClick={() => toggleTerminal(tab.id)}
          className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-mono transition-all shadow-lg border backdrop-blur-md cursor-pointer group ${
            tab.terminalOpen
              ? "bg-sky-950/95 border-sky-500/70 text-sky-200 hover:bg-sky-900 shadow-[0_0_12px_rgba(14,165,233,0.3)]"
              : "bg-shark-900/95 border-shark-750 text-slate-300 hover:text-white hover:bg-shark-850 hover:border-sky-500/40"
          }`}
          title="Toggle Integrated Terminal Drawer (`)"
        >
          <TerminalIcon
            className={`w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform ${
              tab.terminalOpen ? "animate-pulse" : ""
            }`}
          />
          <span className="font-sans font-medium text-[11px]">Terminal</span>
          <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-shark-800 border border-shark-700 text-slate-400 group-hover:text-slate-300">
            `
          </kbd>
        </button>
      </div>
    </div>
  );
};
