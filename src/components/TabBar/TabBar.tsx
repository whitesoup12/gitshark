import React, { useState, useRef, useEffect, useCallback } from "react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { TabItem } from "./TabItem";
import {
  Terminal as TerminalIcon,
  Download,
  Globe,
  GitPullRequest,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { SyncButton } from "./SyncButton";
import { OpenRepoDropdown } from "./OpenRepoDropdown";
import { GitSharkLogo } from "@/components/common/GitSharkLogo";
import { useSharkStore, computeSharkRank } from "@/store/useSharkStore";
import { useCommandPaletteStore } from "@/store/useCommandPaletteStore";
import { openInBrowserIpc } from "@/lib/ipc";

export const TabBar: React.FC = () => {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    toggleTerminal,
    setCloneModalOpen,
    openRepoInBrowser,
    createPullRequestInBrowser,
  } = useWorkspaceStore();
  const { openWisdom, stats } = useSharkStore();
  const rankInfo = computeSharkRank(stats);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  // Update scroll navigation buttons on scroll, resize, or tab list change
  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;

    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => checkScroll());
      ro.observe(el);
    }

    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
      if (ro) ro.disconnect();
    };
  }, [tabs, checkScroll]);

  // Support horizontal wheel scrolling across any mouse
  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta !== 0) {
        e.preventDefault();
        el.scrollLeft += delta;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Auto-scroll active tab into view when active tab changes
  useEffect(() => {
    if (!activeTabId || !tabsScrollRef.current) return;
    const activeEl = tabsScrollRef.current.querySelector<HTMLElement>('[data-active-tab="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
    }
    const timer = setTimeout(checkScroll, 120);
    return () => clearTimeout(timer);
  }, [activeTabId, checkScroll]);

  const scrollTabs = (direction: "left" | "right") => {
    const el = tabsScrollRef.current;
    if (!el) return;
    const amount = Math.max(160, el.clientWidth * 0.45);
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <header className="flex items-center justify-between bg-shark-950 border-b border-shark-800 h-10 select-none px-2 z-20 gap-2 w-full overflow-hidden">
      {/* Left side: Logo + Scrollable tabs strip */}
      <div className="flex items-center h-full flex-1 min-w-0">
        {/* App Logo / Mark + Shark Rank Pill */}
        <button
          onClick={() => openWisdom()}
          className="flex items-center gap-2 px-2.5 py-1 font-bold tracking-tight text-sm select-none border-r border-shark-800 mr-1 flex-shrink-0 group cursor-pointer hover:bg-shark-900/60 rounded transition-all text-left"
          title={`GitShark — ${rankInfo.emoji} ${rankInfo.title} (Lv.${rankInfo.level} • ${rankInfo.totalScore} XP) — Click for GitShark Companion & Stats`}
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

        {/* Scroll Left Chevron Button */}
        {canScrollLeft && (
          <button
            onClick={() => scrollTabs("left")}
            className="flex items-center justify-center w-5 h-7 flex-shrink-0 bg-shark-900 hover:bg-shark-800 text-slate-400 hover:text-slate-100 border border-shark-750 rounded-l transition-all shadow-sm z-10 mr-0.5"
            title="Scroll tabs left"
            aria-label="Scroll tabs left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Tab Items List (horizontally scrollable with mouse wheel or chevrons) */}
        <div
          ref={tabsScrollRef}
          className="flex items-center h-full overflow-x-auto no-scrollbar scroll-smooth flex-1 min-w-0"
        >
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

        {/* Scroll Right Chevron Button */}
        {canScrollRight && (
          <button
            onClick={() => scrollTabs("right")}
            className="flex items-center justify-center w-5 h-7 flex-shrink-0 bg-shark-900 hover:bg-shark-800 text-slate-400 hover:text-slate-100 border border-shark-750 rounded-r transition-all shadow-sm z-10 ml-0.5"
            title="Scroll tabs right"
            aria-label="Scroll tabs right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Fixed Action Controls */}
        <div className="flex items-center flex-shrink-0 ml-1">
          {/* Open Repository Dropdown */}
          <OpenRepoDropdown />

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
      </div>

      {/* Middle: Command Palette Quick Search Launcher */}
      <button
        onClick={() => useCommandPaletteStore.getState().open()}
        className="hidden xl:flex items-center gap-2 h-7 px-2.5 rounded-md bg-shark-900/90 hover:bg-shark-850 border border-shark-800 hover:border-shark-700 text-slate-400 hover:text-slate-200 transition-all text-xs mx-2 shadow-sm flex-shrink-0"
        title="Open Command Palette (Cmd+K / Ctrl+P)"
      >
        <Search className="w-3.5 h-3.5 text-sky-400" />
        <span className="text-[11px] text-slate-400 font-normal">Search or jump to...</span>
        <kbd className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-shark-800 border border-shark-700 text-slate-400">
          ⌘K
        </kbd>
      </button>

      {/* Right side: Global utility toggles for active tab */}
      {activeTab && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Ahead/Behind Sync Button */}
          <SyncButton key={activeTab.id} tab={activeTab} />

          {/* Open in Browser Shortcut Button */}
          <button
            onClick={() => openRepoInBrowser(activeTab.id)}
            className="flex items-center gap-1.5 h-7 px-2 rounded text-xs border border-shark-800 text-slate-400 hover:text-sky-300 hover:border-sky-800/60 hover:bg-shark-850 transition-colors"
            title="Open Repository in Browser (Ctrl+Shift+B / Cmd+Shift+B)"
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline text-[11px]">Browser</span>
          </button>

          {/* Create or Open Pull Request Button */}
          {(() => {
            const currentBranchName = activeTab.metadata?.current_branch;
            const activeBranchPr = currentBranchName
              ? (activeTab.pullRequests || []).find((pr) => pr.source_branch === currentBranchName)
              : null;

            return (
              <button
                onClick={() => {
                  if (activeBranchPr) {
                    openInBrowserIpc(activeBranchPr.url);
                  } else {
                    createPullRequestInBrowser(activeTab.id);
                  }
                }}
                className={`flex items-center gap-1.5 h-7 px-2 rounded text-xs border transition-colors ${
                  activeBranchPr
                    ? "border-emerald-700/60 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60 hover:border-emerald-600 shadow-sm"
                    : "border-shark-800 text-slate-400 hover:text-emerald-300 hover:border-emerald-800/60 hover:bg-shark-850"
                }`}
                title={
                  activeBranchPr
                    ? `Pull Request #${activeBranchPr.number}: ${activeBranchPr.title}${activeBranchPr.is_draft ? " (Draft)" : ""} — Click to open in browser`
                    : "Create Pull Request in Browser (Ctrl+Shift+P / Cmd+Shift+P)"
                }
              >
                <GitPullRequest className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline text-[11px] font-medium">
                  {activeBranchPr ? `PR #${activeBranchPr.number}` : "New PR"}
                </span>
              </button>
            );
          })()}

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
