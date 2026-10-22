import { RepoMetadata, RepoBranches } from "./repo";
import { RepoHooksInfo, HookExecutionState } from "./hooks";
import { WorktreeItem } from "./worktree";
import { RemoteSyncStatus, PullRequestInfo } from "./remote";

export type WorkspaceView = "graph" | "diff" | "status" | "pr";

export interface Tab {
  id: string;
  repoId: string | null;
  title: string;
  path: string | null;
  metadata?: RepoMetadata;
  isLoading: boolean;
  error?: string | null;

  // Viewport & layout state scoped strictly per repository tab
  activeView: WorkspaceView;
  terminalOpen: boolean;
  sidebarCollapsed: boolean;
  selectedCommitHash: string | null;
  selectedFilePath: string | null;

  // Branch comparison / PR View state
  prCompareBase?: string;
  prCompareTarget?: string;
  prSelectedFile?: string | null;

  // Hook state and configuration
  hooksInfo?: RepoHooksInfo;
  hookState?: HookExecutionState;

  // Milestone 5: Worktrees & Remote sync state
  worktrees?: WorktreeItem[];
  remoteSync?: RemoteSyncStatus;

  // Active Pull Requests for branches
  pullRequests?: PullRequestInfo[];

  // Local & Remote Branches
  branches?: RepoBranches;

  // Stashes
  stashes?: import("./repo").StashItem[];

  // Tags
  tags?: import("./repo").GitTagItem[];

  // Global revision counter incremented on every refresh/action to synchronize all UI sections
  refreshEpoch?: number;
}


