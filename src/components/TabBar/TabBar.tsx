import React, { useState, useRef, useEffect, useCallback } from "react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { TabItem } from "./TabItem";
import {
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Code,
  Settings,
  Plus,
} from "lucide-react";
import { OpenRepoDropdown } from "./OpenRepoDropdown";
import { GitSharkLogo } from "@/components/common/GitSharkLogo";
import { useSharkStore, computeSharkRank } from "@/store/useSharkStore";
import { useCommandPaletteStore } from "@/store/useCommandPaletteStore";
import { launchOrFocusCodeShark, pickRepositoryDirectory } from "@/lib/ipc";
import { ChumBucketButton } from "@/components/chum/ChumBucketButton";

export const TabBar: React.FC = () => {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    setCloneModalOpen,
    openRepositoryTab,
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
    <div className="flex flex-col w-full select-none z-20 flex-shrink-0">
      {/* Tier 1: Global Application Header */}
      <header className="flex items-center justify-between bg-shark-950 border-b border-shark-800/80 h-9 px-3 gap-3 w-full">
        {/* Left: App Logo + Shark Companion Level Badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => openWisdom()}
            className="flex items-center gap-2 px-2 py-1 font-bold tracking-tight text-sm select-none group cursor-pointer hover:bg-shark-900/70 rounded-md transition-all text-left"
            title={`GitShark — ${rankInfo.emoji} ${rankInfo.title} (Lv.${rankInfo.level} • ${rankInfo.totalScore} XP) — Click for GitShark Companion & Stats`}
          >
            <GitSharkLogo
              size="sm"
              withBackground={false}
              withGlow={true}
              className="transition-transform group-hover:scale-110 group-hover:rotate-6 duration-200"
            />
            <span className="bg-gradient-to-r from-sky-400 via-teal-300 to-sky-200 bg-clip-text text-transparent font-extrabold tracking-wide">
              GitShark
            </span>
            <span
              className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded border ${rankInfo.badgeClass}`}
            >
              <span>{rankInfo.emoji}</span>
              <span>Lv.{rankInfo.level}</span>
            </span>
          </button>
        </div>

        {/* Center: Centered Command Palette Search Bar + Chum Bucket */}
        <div className="flex-1 max-w-lg flex items-center justify-center gap-2">
          <button
            onClick={() => useCommandPaletteStore.getState().open()}
            className="w-full max-w-sm flex items-center justify-between h-7 px-3 rounded-md bg-shark-900/90 hover:bg-shark-850 border border-shark-800 hover:border-sky-500/40 text-slate-400 hover:text-slate-200 transition-all text-xs shadow-inner group"
            title="Open Command Palette (Cmd+K / Ctrl+P)"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-sky-400 group-hover:text-sky-300 transition-colors" />
              <span className="text-[11px] text-slate-400 group-hover:text-slate-300 font-normal truncate">
                Search commands, repos, branches...
              </span>
            </div>
            <kbd className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-shark-800 border border-shark-700/80 text-slate-400 group-hover:text-slate-300 shadow-sm ml-2">
              ⌘K
            </kbd>
          </button>

          {/* Interactive Chum Bucket Button! */}
          <ChumBucketButton />
        </div>

        {/* Right: Global Actions & Tools */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Open Repository Dropdown */}
          <OpenRepoDropdown />

          {/* Clone Repository Button */}
          <button
            onClick={() => setCloneModalOpen(true)}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded text-xs text-slate-300 hover:text-white hover:bg-shark-850 border border-shark-800 hover:border-shark-700 transition-colors shadow-sm"
            title="Clone Remote Repository"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline font-medium text-[11px]">Clone</span>
          </button>

          {/* CodeShark IDE Launcher Button */}
          <button
            onClick={() => launchOrFocusCodeShark(activeTab?.path || undefined)}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded text-xs text-cyan-300 hover:text-cyan-100 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/60 hover:border-cyan-700 transition-colors shadow-sm"
            title={activeTab ? "Open Repository in CodeShark IDE (Ctrl+Alt+C)" : "Open CodeShark IDE (Ctrl+Alt+O)"}
          >
            <Code className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-[11px]">CodeShark</span>
          </button>

          <div className="h-4 w-[1px] bg-shark-800 mx-0.5" />

          {/* Global Settings & Appearance */}
          <button
            onClick={() => useSettingsStore.getState().openSettings("appearance")}
            className="flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:text-slate-100 hover:bg-shark-850 border border-shark-800 hover:border-shark-700 transition-colors shadow-sm"
            title="Settings & Appearance (Ctrl+,)"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Tier 2: Repository Workspace Tab Strip (Rendered whenever repositories are open) */}
      {tabs.length > 0 && (
        <nav
          aria-label="Repository tabs"
          className="flex items-center justify-between bg-shark-950/90 border-b border-shark-800 h-8 px-2 gap-2 w-full overflow-hidden"
        >
          {/* Left side: Scrollable tabs strip + Add Repo quick button */}
          <div className="flex items-center h-full flex-1 min-w-0">
            {/* Scroll Left Chevron */}
            {canScrollLeft && (
              <button
                onClick={() => scrollTabs("left")}
                className="flex items-center justify-center w-5 h-6 flex-shrink-0 bg-shark-900 hover:bg-shark-800 text-slate-400 hover:text-slate-100 border border-shark-750 rounded-l transition-all shadow-sm z-10 mr-0.5"
                title="Scroll tabs left"
                aria-label="Scroll tabs left"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Horizontally scrollable Tab Items */}
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

            {/* Scroll Right Chevron */}
            {canScrollRight && (
              <button
                onClick={() => scrollTabs("right")}
                className="flex items-center justify-center w-5 h-6 flex-shrink-0 bg-shark-900 hover:bg-shark-800 text-slate-400 hover:text-slate-100 border border-shark-750 rounded-r transition-all shadow-sm z-10 ml-0.5"
                title="Scroll tabs right"
                aria-label="Scroll tabs right"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Add New Repository Quick Plus Button */}
            <button
              onClick={async () => {
                const picked = await pickRepositoryDirectory();
                if (picked) {
                  openRepositoryTab(picked);
                }
              }}
              className="flex items-center justify-center w-6 h-6 ml-1 my-auto rounded text-slate-400 hover:text-sky-300 hover:bg-shark-900 transition-colors border border-transparent hover:border-shark-800 flex-shrink-0"
              title="Open another repository..."
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};
