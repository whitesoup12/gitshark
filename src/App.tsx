import React, { useEffect } from "react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useSharkStore } from "@/store/useSharkStore";
import { TabBar } from "@/components/TabBar/TabBar";
import { WorkspaceShell } from "@/components/Layout/WorkspaceShell";
import { EmptyWorkspace } from "@/components/EmptyState/EmptyWorkspace";
import { CloneWizardModal } from "@/components/Clone/CloneWizardModal";
import { SettingsModal } from "@/components/Settings/SettingsModal";
import { SharkCelebrationOverlay, SharkWisdomModal } from "@/components/common/SharkCompanion";
import { GlobalDialogHost } from "@/components/common/GlobalDialogHost";
import { CommandPaletteModal } from "@/components/palette/CommandPaletteModal";
import { FileBlameModal } from "@/components/blame/FileBlameModal";
import { useCommandPaletteStore } from "@/store/useCommandPaletteStore";
import { useUpdateStore } from "@/store/useUpdateStore";

export const App: React.FC = () => {
  const { tabs, activeTabId, initWorkspaceSession } = useWorkspaceStore();
  const { initSettings, openSettings, isSettingsOpen, closeSettings } = useSettingsStore();
  const { initSharkStats } = useSharkStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    initSettings();
    initSharkStats();
    initWorkspaceSession();
    useUpdateStore.getState().checkForUpdates();
  }, [initSettings, initSharkStats, initWorkspaceSession]);

  // Global keyboard shortcuts: Ctrl+, / Cmd+, for Settings, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette: Cmd+K / Ctrl+K, or Cmd+P / Ctrl+P
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "k" || (e.key.toLowerCase() === "p" && !e.shiftKey))
      ) {
        e.preventDefault();
        useCommandPaletteStore.getState().toggle();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        if (isSettingsOpen) {
          closeSettings();
        } else {
          openSettings("git");
        }
      } else if (e.key === "Escape" && isSettingsOpen) {
        closeSettings();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSettingsOpen, openSettings, closeSettings]);

  // Prevent default native browser/WebView2 context menu across the application
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-shark-950 font-sans">
      {/* Top Multi-Repository Tab Bar */}
      <TabBar />

      {/* Active Tab Workspace Shell or Empty Workspace */}
      {activeTab ? (
        <WorkspaceShell key={activeTab.id} tab={activeTab} />
      ) : (
        <EmptyWorkspace />
      )}

      {/* Global Repository Clone Wizard Modal */}
      <CloneWizardModal />

      {/* Global Application Settings Modal */}
      <SettingsModal />

      {/* Interactive Shark Wisdom Speech Bubble */}
      <SharkWisdomModal />

      {/* Swimming Shark & Commit Bubble Celebration Overlay */}
      <SharkCelebrationOverlay />

      {/* Global Dialog Host for styled alerts, confirms, and prompts */}
      <GlobalDialogHost />

      {/* Global Keyboard-Driven Command Palette */}
      <CommandPaletteModal />

      {/* Global Interactive Blame & File History Inspector */}
      <FileBlameModal />
    </div>
  );
};

export default App;

