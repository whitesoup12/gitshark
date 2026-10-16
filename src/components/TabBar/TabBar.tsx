import React from "react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { TabItem } from "./TabItem";
import { Plus, Terminal as TerminalIcon, Download, Globe, GitPullRequest } from "lucide-react";
import { SyncButton } from "./SyncButton";
import { GitSharkLogo } from "@/components/common/GitSharkLogo";
import { useSharkStore, computeSharkRank } from "@/store/useSharkStore";

export const TabBar: React.FC = () => {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    openRepositoryTab,
    toggleTerminal,
    setCloneModalOpen,
    openRepoInBrowser,
    createPullRequestInBrowser,
  } = useWorkspaceStore();
  const { openWisdom, stats } = useSharkStore();
  const rankInfo = computeSharkRank(stats);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <header className="flex items-center justify-between bg-shark-950 border-b border-shark-800 h-10 select-none px-2 z-20">
      {/* Left side: Tabs container */}
      <div className="flex items-center h-full overflow-x-auto no-scrollbar max-w-[calc(100vw-220px)]">
        {/* App Logo / Mark + Shark Rank Pill */}
        <button
          onClick={() => openWisdom()}
          className="flex items-center gap-2 px-2.5 py-1 font-bold tracking-tight text-sm select-none border-r border-shark-800 mr-1 flex-shrink-0 group cursor-pointer hover:bg-shark-900/60 rounded transition-all text-left"
          title={`GitShark — ${rankInfo.emoji} ${rankInfo.title} (Lv.${rankInfo.level} • ${rankInfo.totalScore} XP) — Click for Shark Telemetry & Wisdom`}
        >
          <GitSharkLogo size="sm" withBackground={false} withGlow={true} className="transition-transform group-hover:scale-110 group-hover:rotate-6 duration-200" />
          <span className="bg-gradient-to-r from-sky-400 via-teal-300 to-sky-200 bg-clip-text text-transparent font-extrabold tracking-wide">
            GitShark
          </span>
          <span
            className={`hidden md:inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded border ${rankInfo.badgeClass}`}
          >
            <span>{rankInfo.emoji}</span>
            <span>Lv.{rankInfo.level}</span>
          </span>
        </button>

        {/* Tab Items List */}
        <div className="flex items-center h-full">
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onSelect={() => setActiveTab(tab.id)}
              onClose={() => closeTab(tab.id)}
            />
          ))}
        </div>

        {/* Open Repository (+) Button */}
        <button
          onClick={() => openRepositoryTab()}
          className="flex items-center gap-1 h-7 px-2 ml-1 rounded text-slate-400 hover:text-slate-100 hover:bg-shark-850 text-xs transition-colors border border-transparent hover:border-shark-750 flex-shrink-0"
          title="Open Repository (Ctrl+O)"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Open Repo</span>
        </button>

        {/* Clone Repository Button */}
        <button
          onClick={() => setCloneModalOpen(true)}
          className="flex items-center gap-1 h-7 px-2 ml-1 rounded text-slate-400 hover:text-slate-100 hover:bg-shark-850 text-xs transition-colors border border-transparent hover:border-shark-750 flex-shrink-0"
          title="Clone Remote Repository"
        >
          <Download className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">Clone</span>
        </button>
      </div>

      {/* Right side: Global utility toggles for active tab */}
      {activeTab && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Ahead/Behind Sync Button */}
          <SyncButton tab={activeTab} />

          {/* Open in Browser Shortcut Button */}
          <button
            onClick={() => openRepoInBrowser(activeTab.id)}
            className="flex items-center gap-1.5 h-7 px-2 rounded text-xs border border-shark-800 text-slate-400 hover:text-sky-300 hover:border-sky-800/60 hover:bg-shark-850 transition-colors"
            title="Open Repository in Browser (Ctrl+Shift+B / Cmd+Shift+B)"
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline text-[11px]">Browser</span>
          </button>

          {/* Create Pull Request Shortcut Button */}
          <button
            onClick={() => createPullRequestInBrowser(activeTab.id)}
            className="flex items-center gap-1.5 h-7 px-2 rounded text-xs border border-shark-800 text-slate-400 hover:text-emerald-300 hover:border-emerald-800/60 hover:bg-shark-850 transition-colors"
            title="Create Pull Request in Browser (Ctrl+Shift+P / Cmd+Shift+P)"
          >
            <GitPullRequest className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline text-[11px]">New PR</span>
          </button>

          <button
            onClick={() => toggleTerminal(activeTab.id)}
            className={`flex items-center gap-1.5 h-7 px-2.5 rounded text-xs transition-colors border ${
              activeTab.terminalOpen
                ? "bg-shark-800 border-sky-500/50 text-sky-300"
                : "border-shark-800 text-slate-400 hover:text-slate-200 hover:bg-shark-850"
            }`}
            title="Toggle PTY Terminal Drawer (`)"
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span className="text-[11px] font-mono">Terminal</span>
          </button>
        </div>
      )}
    </header>
  );
};
