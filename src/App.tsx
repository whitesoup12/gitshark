import React from "react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { TabBar } from "@/components/TabBar/TabBar";
import { WorkspaceShell } from "@/components/Layout/WorkspaceShell";
import { EmptyWorkspace } from "@/components/EmptyState/EmptyWorkspace";
import { CloneWizardModal } from "@/components/Clone/CloneWizardModal";

export const App: React.FC = () => {
  const { tabs, activeTabId } = useWorkspaceStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

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
    </div>
  );
};

export default App;
