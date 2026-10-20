import React, { useEffect, useState, useCallback } from "react";
import { Tab, WorkingTreeStatus, FileDiff, DiffHunk } from "@/types";
import { StagingManager } from "./StagingManager";
import { DiffViewer } from "@/components/diff/DiffViewer";
import { ConflictResolver } from "@/components/conflict/ConflictResolver";
import { RepoOperationBanner } from "@/components/conflict/RepoOperationBanner";
import { useSharkStore } from "@/store/useSharkStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { showConfirm } from "@/store/useDialogStore";
import {
  getWorkingTreeStatusIpc,
  stageFileIpc,
  unstageFileIpc,
  stageAllFilesIpc,
  unstageAllFilesIpc,
  stageHunkIpc,
  unstageHunkIpc,
  discardHunkIpc,
  stageSelectedLinesIpc,
  unstageSelectedLinesIpc,
  discardSelectedLinesIpc,
  discardFileChangesIpc,
  discardAllUnstagedChangesIpc,
  getFileDiffIpc,
  listenToStatusChanged,
} from "@/lib/ipc";

interface WorkspaceDiffSplitProps {
  tab: Tab;
}

export const WorkspaceDiffSplit: React.FC<WorkspaceDiffSplitProps> = ({ tab }) => {
  const [status, setStatus] = useState<WorkingTreeStatus>({
    staged: [],
    unstaged: [],
    untracked: [],
  });
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(
    tab.selectedFilePath || null
  );
  const [selectedFileStaged, setSelectedFileStaged] = useState<boolean>(false);
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [isRefreshingDiff, setIsRefreshingDiff] = useState(false);

  const { updateTab } = useWorkspaceStore();

  // Sync if tab.selectedFilePath changes externally (e.g. from Command Palette)
  useEffect(() => {
    if (tab.selectedFilePath) {
      setSelectedFilePath(tab.selectedFilePath);
      const isStaged = status.staged.some((f) => f.path === tab.selectedFilePath);
      setSelectedFileStaged(isStaged);
    }
  }, [tab.selectedFilePath, status.staged]);

  // 1. Fetch working directory status
  const loadStatus = useCallback(async (silent = false) => {
    if (!tab.repoId) return;
    if (!silent) {
      setIsLoadingStatus(true);
    }
    try {
      const currentStatus = await getWorkingTreeStatusIpc(tab.repoId);
      setStatus(currentStatus);

      // If no file currently selected or previously selected file was removed, auto-select first available file
      setSelectedFilePath((prev) => {
        const preferred = tab.selectedFilePath || prev;

        if (preferred) {
          const inConflicted = currentStatus.conflicted?.some((f) => f.path === preferred);
          const inStaged = currentStatus.staged.some((f) => f.path === preferred);
          const inUnstaged =
            currentStatus.unstaged.some((f) => f.path === preferred) ||
            currentStatus.untracked.some((f) => f.path === preferred);

          if (inConflicted) {
            setSelectedFileStaged(false);
            return preferred;
          }
          if (inStaged) {
            setSelectedFileStaged(true);
            return preferred;
          }
          if (inUnstaged) {
            setSelectedFileStaged(false);
            return preferred;
          }
        }

        // Prioritize conflicted files
        if (currentStatus.conflicted && currentStatus.conflicted.length > 0) {
          setSelectedFileStaged(false);
          return currentStatus.conflicted[0].path;
        }

        const firstUnstaged = currentStatus.unstaged[0] || currentStatus.untracked[0];
        if (firstUnstaged) {
          setSelectedFileStaged(false);
          return firstUnstaged.path;
        }

        const firstStaged = currentStatus.staged[0];
        if (firstStaged) {
          setSelectedFileStaged(true);
          return firstStaged.path;
        }

        return null;
      });
    } catch (err) {
      console.error("Failed to load working tree status:", err);
    } finally {
      if (!silent) {
        setIsLoadingStatus(false);
      }
    }
  }, [tab.repoId]);

  // 2. Fetch diff for selected file
  const loadDiff = useCallback(async (silent = false) => {
    if (!tab.repoId || !selectedFilePath) {
      setDiff(null);
      return;
    }

    if (!silent) {
      setIsLoadingDiff(true);
    } else {
      setIsRefreshingDiff(true);
    }
    try {
      const fileDiff = await getFileDiffIpc(
        tab.repoId,
        selectedFilePath,
        selectedFileStaged
      );
      setDiff(fileDiff);
    } catch (err) {
      console.error("Failed to load file diff:", err);
      if (!silent) {
        setDiff(null);
      }
    } finally {
      if (!silent) {
        setIsLoadingDiff(false);
      } else {
        setIsRefreshingDiff(false);
      }
    }
  }, [tab.repoId, selectedFilePath, selectedFileStaged]);

  // Reset diff to null whenever active selected file changes so the new file diff loads cleanly
  useEffect(() => {
    setDiff(null);
  }, [selectedFilePath, selectedFileStaged]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    loadDiff();
  }, [loadDiff]);

  // 3. Listen to filesystem watcher changes via notify with trailing debounce and silent refresh
  useEffect(() => {
    if (!tab.repoId) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let unlisten: (() => void) | null = null;

    listenToStatusChanged(tab.repoId, () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        loadStatus(true);
        loadDiff(true);
      }, 250);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (unlisten) unlisten();
    };
  }, [tab.repoId, loadStatus, loadDiff]);

  // 4. Auto-refresh working tree status and diff when commit/hook completes, or on branch switch/pull/stash/refreshEpoch
  useEffect(() => {
    loadStatus();
    loadDiff();
  }, [
    tab.refreshEpoch,
    tab.hookState?.status,
    tab.metadata?.current_branch,
    tab.metadata?.head_commit_hash,
    loadStatus,
    loadDiff,
  ]);

  // Staging handlers
  const handleStageFile = async (path: string) => {
    if (!tab.repoId) return;
    await stageFileIpc(tab.repoId, path);
    await loadStatus();
    if (selectedFilePath === path) {
      setSelectedFileStaged(true);
    }
    await loadDiff();
  };

  const handleUnstageFile = async (path: string) => {
    if (!tab.repoId) return;
    await unstageFileIpc(tab.repoId, path);
    await loadStatus();
    if (selectedFilePath === path) {
      setSelectedFileStaged(false);
    }
    await loadDiff();
  };

  const handleStageAll = async () => {
    if (!tab.repoId) return;
    await stageAllFilesIpc(tab.repoId);
    await loadStatus();
    await loadDiff();
  };

  const handleUnstageAll = async () => {
    if (!tab.repoId) return;
    await unstageAllFilesIpc(tab.repoId);
    await loadStatus();
    await loadDiff();
  };

  const handleDiscardFile = async (path: string) => {
    if (!tab.repoId) return;
    await discardFileChangesIpc(tab.repoId, path);
    const fileName = path.split(/[/\\]/).pop() || path;
    useSharkStore.getState().recordSharkStat("chomp", 1);
    useSharkStore
      .getState()
      .triggerCelebration("chomp", `Chomped changes in ${fileName}! 🦈`);
    await loadStatus();
    if (selectedFilePath === path) {
      setDiff(null);
      setSelectedFilePath(null);
    }
  };

  const handleDiscardAll = async () => {
    if (!tab.repoId) return;
    const chompCount = Math.max(
      1,
      status.unstaged.length + status.untracked.length
    );
    await discardAllUnstagedChangesIpc(tab.repoId);
    useSharkStore.getState().recordSharkStat("chomp", chompCount);
    useSharkStore
      .getState()
      .triggerCelebration(
        "chomp",
        `Chomped ${chompCount} unstaged file${chompCount === 1 ? "" : "s"} into the abyss! 🦈`
      );
    await loadStatus();
    if (!selectedFileStaged) {
      setDiff(null);
      setSelectedFilePath(null);
    }
  };

  const handleStageHunk = async (patch: string) => {
    if (!tab.repoId) return;
    await stageHunkIpc(tab.repoId, patch);
    await loadStatus();
    await loadDiff();
  };

  const handleUnstageHunk = async (hunk: DiffHunk) => {
    if (!tab.repoId || !selectedFilePath) return;
    await unstageHunkIpc(tab.repoId, selectedFilePath, hunk);
    await loadStatus();
    await loadDiff();
  };

  const handleDiscardHunk = async (hunk: DiffHunk) => {
    if (!tab.repoId || !selectedFilePath) return;
    const ok = await showConfirm({
      title: "Discard Hunk Changes",
      message: "Are you sure you want to discard this hunk? Unsaved modifications will be permanently lost.",
      confirmText: "Discard Hunk",
      variant: "danger",
    });
    if (!ok) return;
    await discardHunkIpc(tab.repoId, selectedFilePath, hunk);
    await loadStatus();
    await loadDiff();
  };

  const handleStageLines = async (hunk: DiffHunk, lineIndices: number[]) => {
    if (!tab.repoId || !selectedFilePath) return;
    await stageSelectedLinesIpc(tab.repoId, selectedFilePath, hunk, lineIndices);
    await loadStatus();
    await loadDiff();
  };

  const handleUnstageLines = async (hunk: DiffHunk, lineIndices: number[]) => {
    if (!tab.repoId || !selectedFilePath) return;
    await unstageSelectedLinesIpc(tab.repoId, selectedFilePath, hunk, lineIndices);
    await loadStatus();
    await loadDiff();
  };

  const handleDiscardLines = async (hunk: DiffHunk, lineIndices: number[]) => {
    if (!tab.repoId || !selectedFilePath) return;
    const ok = await showConfirm({
      title: "Discard Selected Lines",
      message: `Are you sure you want to discard ${lineIndices.length} selected line(s)? This action cannot be undone.`,
      confirmText: "Discard Lines",
      variant: "danger",
    });
    if (!ok) return;
    await discardSelectedLinesIpc(tab.repoId, selectedFilePath, hunk, lineIndices);
    await loadStatus();
    await loadDiff();
  };

  const handleToggleStageFile = () => {
    if (!selectedFilePath) return;
    if (selectedFileStaged) {
      handleUnstageFile(selectedFilePath);
    } else {
      handleStageFile(selectedFilePath);
    }
  };

  const isSelectedFileConflicted = Boolean(
    selectedFilePath &&
      status.conflicted?.some((f) => f.path === selectedFilePath)
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden w-full h-full">
      {/* Top Lifecycle Operation Banner (if in merge/rebase/etc. or has conflicts) */}
      <RepoOperationBanner
        tab={tab}
        status={status}
        onRefresh={loadStatus}
      />

      <div className="flex-1 flex overflow-hidden w-full min-h-0">
        {/* Left Drawer: Working Directory Staging List */}
        <StagingManager
          tab={tab}
          status={status}
          selectedFilePath={selectedFilePath}
          selectedFileStaged={selectedFileStaged}
          onSelectFile={(path, staged) => {
            setSelectedFilePath(path);
            setSelectedFileStaged(staged);
            updateTab(tab.id, { selectedFilePath: path });
          }}
          onStageFile={handleStageFile}
          onUnstageFile={handleUnstageFile}
          onStageAll={handleStageAll}
          onUnstageAll={handleUnstageAll}
          onDiscardFile={handleDiscardFile}
          onDiscardAll={handleDiscardAll}
          onRefresh={loadStatus}
          isLoading={isLoadingStatus}
        />

        {/* Right Pane: Interactive Conflict Resolver OR Diff Viewer */}
        {isSelectedFileConflicted && selectedFilePath ? (
          <ConflictResolver
            tab={tab}
            filePath={selectedFilePath}
            onResolved={async () => {
              await loadStatus();
            }}
          />
        ) : (
          <DiffViewer
            diff={diff}
            filePath={selectedFilePath}
            isStaged={selectedFileStaged}
            onStageHunk={handleStageHunk}
            onUnstageHunk={handleUnstageHunk}
            onDiscardHunk={handleDiscardHunk}
            onStageLines={handleStageLines}
            onUnstageLines={handleUnstageLines}
            onDiscardLines={handleDiscardLines}
            onToggleStageFile={handleToggleStageFile}
            isLoading={isLoadingDiff}
            isRefreshing={isRefreshingDiff}
            repoId={tab.repoId}
            tabId={tab.id}
          />
        )}
      </div>
    </div>
  );
};
