import React, { useState, useEffect } from "react";
import type { Tab } from "@/types";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { showConfirm } from "@/store/useDialogStore";
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  UploadCloud,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { formatShortHash } from "@/lib/utils";

interface TagSectionProps {
  tab: Tab;
  isOpen: boolean;
  onToggle: () => void;
}

export const TagSection: React.FC<TagSectionProps> = ({
  tab,
  isOpen,
  onToggle,
}) => {
  const {
    fetchTags,
    createTag,
    deleteTag,
    pushTag,
    setActiveView,
    updateTab,
  } = useWorkspaceStore();

  const [isAdding, setIsAdding] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const [pushToRemote, setPushToRemote] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activePushingTag, setActivePushingTag] = useState<string | null>(null);

  useEffect(() => {
    if (tab.repoId && !tab.tags) {
      fetchTags(tab.id);
    }
  }, [tab.id, tab.repoId, tab.tags, fetchTags]);

  const tags = tab.tags ?? [];

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tab.repoId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await fetchTags(tab.id);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const success = await createTag(
        tab.id,
        tagName.trim(),
        tab.selectedCommitHash || undefined,
        tagMessage.trim() || undefined,
        pushToRemote
      );
      if (success) {
        setTagName("");
        setTagMessage("");
        setPushToRemote(false);
        setIsAdding(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTag = async (name: string) => {
    const confirmed = await showConfirm({
      title: "Delete Tag",
      message: `Are you sure you want to delete tag "${name}"? This action cannot be undone.`,
      confirmText: "Delete Tag",
      variant: "danger",
    });

    if (confirmed) {
      await deleteTag(tab.id, name);
    }
  };

  const handlePushTag = async (name: string) => {
    setActivePushingTag(name);
    try {
      await pushTag(tab.id, name);
    } finally {
      setActivePushingTag(null);
    }
  };

  const handleSelectTagCommit = (commitHash: string) => {
    setActiveView(tab.id, "graph");
    updateTab(tab.id, { selectedCommitHash: commitHash });
  };

  return (
    <div>
      {/* Section Header */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between px-1.5 py-1 text-slate-300 hover:text-slate-100 font-medium cursor-pointer select-none group"
      >
        <div className="flex items-center gap-1.5 truncate">
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
          )}
          <Bookmark className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="truncate">Tags</span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-slate-500 font-mono">
            {tags.length}
          </span>

          <button
            onClick={handleRefresh}
            className="p-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-shark-750 transition-colors opacity-0 group-hover:opacity-100"
            title="Refresh tags"
          >
            <RefreshCw
              className={`w-3 h-3 ${isRefreshing ? "animate-spin text-amber-400" : ""}`}
            />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsAdding((prev) => !prev);
              if (!isOpen) onToggle();
            }}
            className="p-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-shark-750 transition-colors"
            title="Create tag"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-1 space-y-1 pl-3">
          {/* Create Tag Form */}
          {isAdding && (
            <form
              onSubmit={handleCreateTag}
              className="p-2 rounded bg-shark-850 border border-shark-750 space-y-2 mb-2 text-xs"
            >
              <div className="text-[11px] font-semibold text-slate-200">
                Create New Tag
                {tab.selectedCommitHash && (
                  <span className="block text-[10px] text-amber-400/90 font-mono font-normal">
                    on commit {formatShortHash(tab.selectedCommitHash)}
                  </span>
                )}
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Tag name (e.g. v1.0.0)"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-2 py-1 rounded bg-shark-900 border border-shark-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Annotation message (optional)"
                  value={tagMessage}
                  onChange={(e) => setTagMessage(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-shark-900 border border-shark-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pushToRemote}
                  onChange={(e) => setPushToRemote(e.target.checked)}
                  className="rounded bg-shark-900 border-shark-700 text-amber-500 focus:ring-0"
                />
                <span>Push tag to remote origin</span>
              </label>

              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-slate-200 hover:bg-shark-750"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!tagName.trim() || isSubmitting}
                  className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Bookmark className="w-3 h-3" />
                  )}
                  <span>Create</span>
                </button>
              </div>
            </form>
          )}

          {/* Tags List */}
          {tags.length === 0 ? (
            <div className="px-2 py-2 text-[11px] text-slate-500 italic">
              No tags found
            </div>
          ) : (
            tags.map((tag) => (
              <div
                key={tag.name}
                onClick={() => handleSelectTagCommit(tag.target_commit)}
                className="group flex items-center justify-between px-2 py-1 rounded text-[11px] hover:bg-shark-850 cursor-pointer transition-colors"
                title={`${tag.name} -> ${tag.target_commit}${tag.message ? `\n"${tag.message}"` : ""}`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Bookmark className="w-3 h-3 text-amber-400 flex-shrink-0" />
                  <span className="truncate text-slate-200 font-medium font-mono">
                    {tag.name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {formatShortHash(tag.target_commit)}
                  </span>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePushTag(tag.name);
                    }}
                    disabled={activePushingTag === tag.name}
                    className="p-0.5 rounded text-slate-400 hover:text-amber-300 hover:bg-shark-750 transition-colors"
                    title={`Push tag '${tag.name}' to remote origin`}
                  >
                    {activePushingTag === tag.name ? (
                      <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                    ) : (
                      <UploadCloud className="w-3 h-3" />
                    )}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTag(tag.name);
                    }}
                    className="p-0.5 rounded text-slate-400 hover:text-rose-400 hover:bg-shark-750 transition-colors"
                    title={`Delete tag '${tag.name}'`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
