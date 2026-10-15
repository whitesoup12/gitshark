import React from "react";
import { Tab } from "@/types";
import { GitBranch, X, Loader2, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

export const TabItem: React.FC<TabItemProps> = ({
  tab,
  isActive,
  onSelect,
  onClose,
}) => {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    // Close tab on middle click
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      onClick={onSelect}
      onAuxClick={handleAuxClick}
      className={cn(
        "group relative flex items-center gap-2 px-3 py-1.5 h-9 max-w-[220px] min-w-[130px] cursor-pointer text-xs font-medium border-r border-shark-800 transition-colors select-none",
        isActive
          ? "bg-shark-900 text-slate-100 shadow-sm"
          : "bg-shark-950/70 text-slate-400 hover:bg-shark-900/60 hover:text-slate-200"
      )}
      title={tab.path ?? tab.title}
    >
      {/* Active tab top indicator line */}
      {isActive && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-sky-500 animate-in fade-in duration-200" />
      )}

      {/* Leading icon / loading spinner */}
      <div className="flex-shrink-0 text-slate-400 group-hover:text-slate-200">
        {tab.isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
        ) : tab.metadata?.current_branch ? (
          <GitBranch className={cn("w-3.5 h-3.5", isActive ? "text-sky-400" : "text-slate-400")} />
        ) : (
          <CircleDot className="w-3.5 h-3.5 text-slate-500" />
        )}
      </div>

      {/* Tab Title */}
      <span className="truncate flex-1 font-semibold">{tab.title}</span>

      {/* Dirty indicator */}
      {tab.metadata?.is_dirty && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"
          title="Uncommitted changes in repository"
        />
      )}

      {/* Close button */}
      <button
        onClick={handleClose}
        className={cn(
          "w-4 h-4 rounded flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-shark-750 text-slate-400 hover:text-slate-100",
          isActive && "opacity-80"
        )}
        title="Close Tab (Ctrl+W / Middle-click)"
        aria-label="Close Tab"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
