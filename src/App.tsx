import React, { useEffect } from "react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { TabBar } from "@/components/TabBar/TabBar";
import { WorkspaceShell } from "@/components/Layout/WorkspaceShell";
import { EmptyWorkspace } from "@/components/EmptyState/EmptyWorkspace";
import { CloneWizardModal } from "@/components/Clone/CloneWizardModal";
import { SettingsModal } from "@/components/Settings/SettingsModal";

export const App: React.FC = () => {
  const { tabs, activeTabId } = useWorkspaceStore();
  const { initSettings, openSettings, isSettingsOpen, closeSettings } = useSettingsStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    initSettings();
  }, [initSettings]);

  // Global keyboard shortcuts: Ctrl+, / Cmd+, for Settings, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    </div>
  );
};

export default App;

