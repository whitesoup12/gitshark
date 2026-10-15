import React, { useState, useEffect } from "react";
import { Tab, StashItem } from "@/types";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";

interface StashSectionProps {
  tab: Tab;
  isOpen: boolean;
  onToggle: () => void;
}

export const StashSection: React.FC<StashSectionProps> = ({
  tab,
  isOpen,
  onToggle,
}) => {
  const { fetchStashes, createStash, applyStash, dropStash } =
    useWorkspaceStore();

  const [isAdding, setIsAdding] = useState(false);
  const [stashMessage, setStashMessage] = useState("");
  const [includeUntracked, setIncludeUntracked] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeActionIndex, setActiveActionIndex] = useState<number | null>(null);

  useEffect(() => {
    if (tab.repoId && !tab.stashes) {
      fetchStashes(tab.id);
    }
  }, [tab.id, tab.repoId, tab.stashes, fetchStashes]);

  const stashes = tab.stashes ?? [];

  const handleCreateStash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const success = await createStash(
        tab.id,
        stashMessage.trim() || undefined,
        includeUntracked
      );
      if (success) {
        setStashMessage("");
        setIsAdding(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApply = async (index: number, pop: boolean) => {
    setActiveActionIndex(index);
    try {
      await applyStash(tab.id, index, pop);
    } finally {
      setActiveActionIndex(null);
    }
  };

  const handleDrop = async (stash: StashItem) => {
    if (
      window.confirm(
        `Are you sure you want to drop stash@{${stash.index}}?\n"${stash.message}"`
      )
    ) {
      setActiveActionIndex(stash.index);
      try {
        await dropStash(tab.id, stash.index);
      } finally {
        setActiveActionIndex(null);
      }
    }
  };

  return (
    <div>
      {/* Stash Header Accordion */}
      <div className="flex items-center justify-between w-full px-1.5 py-1 text-slate-300 font-medium select-none">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 hover:text-slate-100 flex-1 text-left"
        >
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          <Archive className="w-3.5 h-3.5 text-slate-400" />
          <span>Stashes</span>
          <span className="text-[10px] text-slate-500 font-mono">
            ({stashes.length})
          </span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isOpen) onToggle();
            setIsAdding((prev) => !prev);
          }}
          className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-shark-800 transition-colors"
          title="Save New Stash (git stash push)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stashes List */}
      {isOpen && (
        <div className="mt-1 space-y-1 pl-3 text-xs">
          {/* Create Stash Form */}
          {isAdding && (
            <form
              onSubmit={handleCreateStash}
              className="p-2.5 bg-shark-950 border border-sky-600/40 rounded-lg space-y-2 mb-2 text-xs select-none shadow-md"
            >
              <div className="text-[11px] font-bold text-sky-300 flex items-center gap-1">
                <Archive className="w-3 h-3" />
                <span>Save Changes to Stash</span>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Message (Optional)</label>
                <input
                  type="text"
                  value={stashMessage}
                  onChange={(e) => setStashMessage(e.target.value)}
                  placeholder="e.g. WIP: refactoring parser"
                  className="w-full px-2 py-1 bg-shark-900 border border-shark-750 focus:border-sky-500 rounded text-[11px] font-mono text-slate-200 outline-none"
                  autoFocus
                />
              </div>

              <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeUntracked}
                  onChange={(e) => setIncludeUntracked(e.target.checked)}
                  className="rounded bg-shark-900 border-shark-700 text-sky-500"
                />
                <span>Include untracked files (-u)</span>
              </label>

              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-slate-200 hover:bg-shark-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-medium text-[10px]"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <span>Stash</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {stashes.length === 0 ? (
            <div className="text-slate-500 text-[11px] italic py-1 pl-1">
              No active stashes
            </div>
          ) : (
            stashes.map((s) => {
              const isWorking = activeActionIndex === s.index;
              return (
                <div
                  key={`${s.index}-${s.commit_id}`}
                  className="group flex items-center justify-between px-2 py-1.5 rounded hover:bg-shark-850/80 border border-transparent hover:border-shark-750 transition-colors select-none text-[11px]"
                >
                  <div className="truncate flex-1 mr-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-mono text-[10px] text-sky-400 bg-sky-950/80 px-1 rounded border border-sky-800/60">
                        stash@&#123;{s.index}&#125;
                      </span>
                      <span className="font-medium text-slate-200 truncate" title={s.message}>
                        {s.message}
                      </span>
                    </div>
                  </div>

                  {/* Actions on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isWorking ? (
                      <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                    ) : (
                      <>
                        <button
                          onClick={() => handleApply(s.index, false)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-shark-800 hover:bg-sky-950 text-slate-300 hover:text-sky-300 transition-colors"
                          title="Apply stash (keep in stash list)"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => handleApply(s.index, true)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-shark-800 hover:bg-emerald-950 text-slate-300 hover:text-emerald-300 transition-colors"
                          title="Pop stash (apply and remove from stash list)"
                        >
                          Pop
                        </button>
                        <button
                          onClick={() => handleDrop(s)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-shark-800 transition-colors"
                          title="Drop (delete) stash"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
