import React, { useEffect, useState, useCallback } from "react";
import { Tab, WorkingTreeStatus, FileDiff } from "@/types";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { StagingManager } from "./StagingManager";
import { DiffViewer } from "@/components/diff/DiffViewer";
import {
  getWorkingTreeStatusIpc,
  stageFileIpc,
  unstageFileIpc,
  stageAllFilesIpc,
  unstageAllFilesIpc,
  stageHunkIpc,
  discardFileChangesIpc,
  getFileDiffIpc,
  listenToStatusChanged,
} from "@/lib/ipc";

interface WorkspaceDiffSplitProps {
  tab: Tab;
}

export const WorkspaceDiffSplit: React.FC<WorkspaceDiffSplitProps> = ({ tab }) => {
  const { refreshTabMetadata } = useWorkspaceStore();

  const [status, setStatus] = useState<WorkingTreeStatus>({
    staged: [],
    unstaged: [],
    untracked: [],
  });
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileStaged, setSelectedFileStaged] = useState<boolean>(false);
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);

  // 1. Fetch working directory status
  const loadStatus = useCallback(async () => {
    if (!tab.repoId) return;
    setIsLoadingStatus(true);
    try {
      const currentStatus = await getWorkingTreeStatusIpc(tab.repoId);
      setStatus(currentStatus);
      refreshTabMetadata(tab.id);

      // If no file currently selected, auto-select first available file
      setSelectedFilePath((prev) => {
        if (prev) return prev;
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
      setIsLoadingStatus(false);
    }
  }, [tab.repoId, tab.id, refreshTabMetadata]);

  // 2. Fetch diff for selected file
  const loadDiff = useCallback(async () => {
    if (!tab.repoId || !selectedFilePath) {
      setDiff(null);
      return;
    }

    setIsLoadingDiff(true);
    try {
      const fileDiff = await getFileDiffIpc(
        tab.repoId,
        selectedFilePath,
        selectedFileStaged
      );
      setDiff(fileDiff);
    } catch (err) {
      console.error("Failed to load file diff:", err);
      setDiff(null);
    } finally {
      setIsLoadingDiff(false);
    }
  }, [tab.repoId, selectedFilePath, selectedFileStaged]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    loadDiff();
  }, [loadDiff]);

  // 3. Listen to filesystem watcher changes via notify
  useEffect(() => {
    if (!tab.repoId) return;

    let unlisten: (() => void) | null = null;
    listenToStatusChanged(tab.repoId, () => {
      loadStatus();
      loadDiff();
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [tab.repoId, loadStatus, loadDiff]);

  // 4. Auto-refresh working tree status and diff when commit/hook completes
  useEffect(() => {
    if (tab.hookState?.status === "passed") {
      loadStatus();
      loadDiff();
    }
  }, [tab.hookState?.status, loadStatus, loadDiff]);

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
    await loadStatus();
    if (selectedFilePath === path) {
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

  const handleToggleStageFile = () => {
    if (!selectedFilePath) return;
    if (selectedFileStaged) {
      handleUnstageFile(selectedFilePath);
    } else {
      handleStageFile(selectedFilePath);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden w-full h-full">
      {/* Left Drawer: Working Directory Staging List */}
      <StagingManager
        tab={tab}
        status={status}
        selectedFilePath={selectedFilePath}
        selectedFileStaged={selectedFileStaged}
        onSelectFile={(path, staged) => {
          setSelectedFilePath(path);
          setSelectedFileStaged(staged);
        }}
        onStageFile={handleStageFile}
        onUnstageFile={handleUnstageFile}
        onStageAll={handleStageAll}
        onUnstageAll={handleUnstageAll}
        onDiscardFile={handleDiscardFile}
        onRefresh={loadStatus}
        isLoading={isLoadingStatus}
      />

      {/* Right Pane: Interactive Diff Viewer */}
      <DiffViewer
        diff={diff}
        filePath={selectedFilePath}
        isStaged={selectedFileStaged}
        onStageHunk={handleStageHunk}
        onToggleStageFile={handleToggleStageFile}
        isLoading={isLoadingDiff}
      />
    </div>
  );
};
