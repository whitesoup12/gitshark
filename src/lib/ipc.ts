import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type {
  RepoMetadata,
  TerminalDataPayload,
  TerminalExitPayload,
  RepoHooksInfo,
  WorktreeItem,
  RemoteSyncStatus,
  CloneOptions,
  CloneProgressPayload,
  RepoBranches,
  StashItem,
  StashDetails,
  FileDiff,
  CommitDetails,
  GitTagItem,
  GitBinaryInfo,
} from "@/types";
import { showPrompt } from "@/store/useDialogStore";

export const isTauriEnvironment = (): boolean => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

/**
 * Open native directory picker to select a local Git repository folder
 */
export async function pickRepositoryDirectory(): Promise<string | null> {
  try {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "Select Git Repository Directory",
    });

    if (Array.isArray(selected)) {
      return selected[0] ?? null;
    }
    return selected;
  } catch (err) {
    if (!isTauriEnvironment()) {
      const promptPath = await showPrompt({
        title: "Open Repository",
        message: "Enter absolute path to Git repository folder:",
        placeholder: "/path/to/repository",
        confirmText: "Open",
      });
      return promptPath && promptPath.trim().length > 0 ? promptPath.trim() : null;
    }
    console.error("Failed to open native file explorer dialog:", err);
    return null;
  }
}

/**
 * Open native directory picker to select a development directory
 */
export async function pickDirectory(title = "Select Development Directory"): Promise<string | null> {
  try {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title,
    });

    if (Array.isArray(selected)) {
      return selected[0] ?? null;
    }
    return selected;
  } catch (err) {
    if (!isTauriEnvironment()) {
      const promptPath = await showPrompt({
        title,
        message: "Enter absolute directory path:",
        placeholder: "D:\\Development",
        confirmText: "Select",
      });
      return promptPath && promptPath.trim().length > 0 ? promptPath.trim() : null;
    }
    console.error("Failed to open directory dialog:", err);
    return null;
  }
}

export interface DevFolderItem {
  name: string;
  path: string;
  is_git_repo: boolean;
}

/**
 * List folders inside the development directory
 */
export async function listDevFoldersIpc(dirPath: string): Promise<DevFolderItem[]> {
  if (!isTauriEnvironment()) {
    return [
      { name: "gitshark", path: `${dirPath}/gitshark`, is_git_repo: true },
      { name: "aquarium-app", path: `${dirPath}/aquarium-app`, is_git_repo: true },
      { name: "docs-site", path: `${dirPath}/docs-site`, is_git_repo: false },
    ];
  }
  return await invoke<DevFolderItem[]>("list_dev_folders", { dirPath });
}

/**
 * Open repository via local filesystem path, creating a RepoSession in Rust
 */
export async function openRepositoryIpc(path: string): Promise<RepoMetadata> {
  if (!isTauriEnvironment()) {
    // Mock for browser testing
    console.warn("Running outside Tauri environment. Using simulated RepoMetadata.");
    await new Promise((r) => setTimeout(r, 400));
    return {
      id: "simulated-" + Math.random().toString(36).substring(2, 9),
      name: path.split(/[/\\]/).filter(Boolean).pop() || "local-repo",
      path: path,
      current_branch: "main",
      is_detached: false,
      head_commit_hash: "a1b2c3d4e5f67890123456789abcdef01234567",
      head_commit_summary: "feat: scaffold workspace and PTY streaming IPC",
      is_dirty: true,
      staged_count: 2,
      unstaged_count: 1,
      untracked_count: 0,
    };
  }

  return await invoke<RepoMetadata>("open_repository", { path });
}

/**
 * Close repository and drop RepoSession from memory
 */
export async function closeRepositoryIpc(id: string): Promise<void> {
  if (!isTauriEnvironment()) return;
  return await invoke<void>("close_repository", { id });
}

/**
 * Refresh and query the latest metadata for an open repository session
 */
export async function getRepositoryMetadataIpc(id: string): Promise<RepoMetadata> {
  if (!isTauriEnvironment()) {
    throw new Error("Tauri environment not detected");
  }
  return await invoke<RepoMetadata>("get_repository_metadata", { id });
}

/**
 * Spawn a native process inside portable-pty scoped to the repository working directory
 */
export async function executePtyCommandIpc(
  id: string,
  command: string,
  args: string[] = [],
  cols: number = 80,
  rows: number = 24
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] Executing command: ${command} ${args.join(" ")}`);
    return;
  }

  return await invoke<void>("execute_pty_command", {
    id,
    command,
    args,
    cols,
    rows,
  });
}

/**
 * Send keystrokes / stdin directly into the running PTY process
 */
export async function writePtyInputIpc(id: string, data: string): Promise<void> {
  if (!isTauriEnvironment()) return;
  return await invoke<void>("write_pty_input", { id, data });
}

/**
 * Notify PTY of terminal resize
 */
export async function resizePtyIpc(id: string, cols: number, rows: number): Promise<void> {
  if (!isTauriEnvironment()) return;
  return await invoke<void>("resize_pty", { id, cols, rows });
}

/**
 * Kill active PTY process
 */
export async function killPtyIpc(id: string): Promise<void> {
  if (!isTauriEnvironment()) return;
  return await invoke<void>("kill_pty", { id });
}

/**
 * Listen to terminal chunk stream for a specific repository session
 */
export async function listenToTerminalData(
  repoId: string,
  onData: (data: string) => void
): Promise<UnlistenFn> {
  if (!isTauriEnvironment()) {
    return () => {};
  }
  return await listen<TerminalDataPayload>(`repo:${repoId}:terminal_data`, (event) => {
    onData(event.payload.data);
  });
}

/**
 * Listen to terminal process exit notification
 */
export async function listenToTerminalExit(
  repoId: string,
  onExit: (payload: TerminalExitPayload) => void
): Promise<UnlistenFn> {
  if (!isTauriEnvironment()) {
    return () => {};
  }
  return await listen<TerminalExitPayload>(`repo:${repoId}:terminal_exit`, (event) => {
    onExit(event.payload);
  });
}

/**
 * Fetch topological commit DAG graph with precomputed lane allocations & edge vectors
 */
export async function getCommitGraphIpc(
  repoId: string,
  limit: number = 1000,
  skip: number = 0
): Promise<import("@/types").CommitNode[]> {
  if (!isTauriEnvironment()) {
    return generateMockCommitGraph(limit);
  }

  return await invoke<import("@/types").CommitNode[]>("get_commit_graph", {
    repoId,
    limit,
    skip,
  });
}

/**
 * Generates an authentic simulated multi-branch commit DAG for browser preview
 */
function generateMockCommitGraph(count: number): import("@/types").CommitNode[] {
  const nodes: import("@/types").CommitNode[] = [];
  const authors = ["Elena Vance", "Marcus Bell", "Aria Stark", "Devin Cole"];
  const messages = [
    "feat(graph): implement virtualized canvas rendering engine",
    "fix(ipc): handle PTY broken pipe on process termination",
    "Merge branch 'feature/canvas-dag' into main",
    "perf: optimize revwalk topological lane calculation in Rust",
    "docs: update architecture constraints and milestone guide",
    "feat(tabs): tab-isolated repository state container",
    "Merge branch 'fix/xterm-resize' into main",
    "fix(terminal): debounce PTY resize observer events",
    "style: modernize dark ocean theme palette",
    "chore(deps): update git2-rs to v0.20 with vendored libgit2",
    "Merge pull request #42 from gitshark/feature/bezier-curves",
    "feat(ui): smooth cubic bezier curve routing for merge lines",
    "refactor: extract workspace shell into modular subviews",
    "feat: add git ref badges for HEAD, local and remote branches",
    "initial commit: GitShark foundation and Tauri v2 scaffolding",
  ];

  const now = Math.floor(Date.now() / 1000);

  // Synthesize realistic lanes and merges
  for (let i = 0; i < Math.min(count, 45); i++) {
    const isMerge = i === 2 || i === 6 || i === 10 || i === 18 || i === 25;
    const isBranch = i === 3 || i === 7 || i === 11 || i === 19 || i === 26;
    const lane = isBranch ? 1 : isMerge ? 0 : i % 7 === 4 ? 2 : 0;
    const colorIndex = lane % 8;

    const edges: import("@/types").Edge[] = [];
    const parentRow = i + 1;

    if (i < 44) {
      if (isMerge) {
        // Primary parent on lane 0
        edges.push({
          from_lane: 0,
          to_lane: 0,
          to_row: parentRow,
          is_merge: false,
          color_index: 0,
        });
        // Secondary parent merged from lane 1
        edges.push({
          from_lane: 0,
          to_lane: 1,
          to_row: parentRow + 1,
          is_merge: true,
          color_index: 1,
        });
      } else if (isBranch) {
        // Branching or continuing in lane 1
        edges.push({
          from_lane: 1,
          to_lane: i === 5 || i === 9 || i === 13 ? 0 : 1,
          to_row: parentRow,
          is_merge: false,
          color_index: 1,
        });
      } else {
        edges.push({
          from_lane: lane,
          to_lane: lane,
          to_row: parentRow,
          is_merge: false,
          color_index: colorIndex,
        });
      }
    }

    const refs: import("@/types").GitRefBadge[] = [];
    if (i === 0) {
      refs.push({ name: "HEAD", shorthand: "HEAD", kind: "head", is_head: true });
      refs.push({ name: "refs/heads/main", shorthand: "main", kind: "local_branch", is_head: false });
      refs.push({ name: "refs/remotes/origin/main", shorthand: "origin/main", kind: "remote_branch", is_head: false });
    } else if (i === 1) {
      refs.push({ name: "refs/heads/feature/canvas-dag", shorthand: "feature/canvas-dag", kind: "local_branch", is_head: false });
    } else if (i === 5) {
      refs.push({ name: "refs/tags/v0.1.0", shorthand: "v0.1.0", kind: "tag", is_head: false });
    } else if (i === 12) {
      refs.push({ name: "refs/remotes/origin/develop", shorthand: "origin/develop", kind: "remote_branch", is_head: false });
    }

    const hash = Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");

    nodes.push({
      id: hash,
      summary: messages[i % messages.length],
      author: authors[i % authors.length],
      author_email: `${authors[i % authors.length].toLowerCase().replace(" ", ".")}@gitshark.dev`,
      timestamp: now - i * 3600 * 4,
      hash,
      parents: i < 44 ? [Array.from({ length: 40 }, () => "f").join("")] : [],
      lane,
      color_index: colorIndex,
      edges,
      refs,
    });
  }

  return nodes;
}

/**
 * Fetch categorized working tree status (staged, unstaged, untracked)
 */
export async function getWorkingTreeStatusIpc(
  repoId: string
): Promise<import("@/types").WorkingTreeStatus> {
  if (!isTauriEnvironment()) {
    return {
      staged: [
        { path: "src/lib/ipc.ts", status: "modified", staged: true },
        { path: "src/types/diff.ts", status: "new", staged: true },
      ],
      unstaged: [
        { path: "src-tauri/src/git.rs", status: "modified", staged: false },
        { path: "src-tauri/src/commands.rs", status: "modified", staged: false },
      ],
      untracked: [
        { path: "src/components/diff/DiffViewer.tsx", status: "untracked", staged: false },
      ],
    };
  }

  return await invoke<import("@/types").WorkingTreeStatus>("get_working_tree_status", {
    repoId,
  });
}

/**
 * Stage a specific file in the index
 */
export async function stageFileIpc(repoId: string, path: string): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] Stage file: ${path}`);
    return;
  }
  return await invoke<void>("stage_file", { repoId, path });
}

/**
 * Unstage a specific file from the index back to HEAD
 */
export async function unstageFileIpc(repoId: string, path: string): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] Unstage file: ${path}`);
    return;
  }
  return await invoke<void>("unstage_file", { repoId, path });
}

/**
 * Stage all modified, deleted, and untracked files
 */
export async function stageAllFilesIpc(repoId: string): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] Stage all files`);
    return;
  }
  return await invoke<void>("stage_all_files", { repoId });
}

/**
 * Unstage all files in the index
 */
export async function unstageAllFilesIpc(repoId: string): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] Unstage all files`);
    return;
  }
  return await invoke<void>("unstage_all_files", { repoId });
}

/**
 * Stage an individual diff hunk patch directly to the index
 */
export async function stageHunkIpc(repoId: string, patch: string): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] Stage hunk patch:\n${patch}`);
    return;
  }
  return await invoke<void>("stage_hunk", { repoId, patch });
}

/**
 * Discard working tree changes for a file (checkout from HEAD or delete untracked)
 */
export async function discardFileChangesIpc(repoId: string, path: string): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] Discard changes for: ${path}`);
    return;
  }
  return await invoke<void>("discard_file_changes", { repoId, path });
}

/**
 * Discard all unstaged working tree changes and delete untracked files
 */
export async function discardAllUnstagedChangesIpc(repoId: string): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] Discard all unstaged changes in: ${repoId}`);
    return;
  }
  return await invoke<void>("discard_all_unstaged_changes", { repoId });
}

/**
 * Fetch line-by-line structured diff data for a file
 */
export async function getFileDiffIpc(
  repoId: string,
  path: string,
  staged: boolean
): Promise<import("@/types").FileDiff> {
  if (!isTauriEnvironment()) {
    return {
      old_path: path,
      new_path: path,
      is_binary: false,
      is_new: false,
      is_deleted: false,
      total_additions: 4,
      total_deletions: 2,
      hunks: [
        {
          header: "@@ -14,6 +14,8 @@",
          old_start: 14,
          old_lines: 6,
          new_start: 14,
          new_lines: 8,
          patch: `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -14,6 +14,8 @@\n export const ROW_HEIGHT = 28;\n-export const LANE_WIDTH = 14;\n+export const LANE_WIDTH = 16;\n+export const NODE_RADIUS = 4.5;\n export const GRAPH_PADDING_X = 20;\n`,
          lines: [
            { origin: " ", old_lineno: 14, new_lineno: 14, content: "export const ROW_HEIGHT = 28;" },
            { origin: "-", old_lineno: 15, new_lineno: null, content: "export const LANE_WIDTH = 14;" },
            { origin: "+", old_lineno: null, new_lineno: 15, content: "export const LANE_WIDTH = 16;" },
            { origin: "+", old_lineno: null, new_lineno: 16, content: "export const NODE_RADIUS = 4.5;" },
            { origin: " ", old_lineno: 16, new_lineno: 17, content: "export const GRAPH_PADDING_X = 20;" },
          ],
        },
      ],
    };
  }

  return await invoke<import("@/types").FileDiff>("get_file_diff", {
    repoId,
    path,
    staged,
  });
}

/**
 * Listen to filesystem watcher auto-refresh events
 */
export async function listenToStatusChanged(
  repoId: string,
  onStatusChanged: () => void
): Promise<UnlistenFn> {
  if (!isTauriEnvironment()) {
    return () => {};
  }
  return await listen(`repo:${repoId}:status_changed`, () => {
    onStatusChanged();
  });
}

/**
 * Execute native git commit in PTY streaming to active tab xterm
 */
export async function executeGitCommitIpc(
  repoId: string,
  message: string,
  amend: boolean = false
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] git commit -m "${message}" (amend=${amend})`);
    return;
  }
  return await invoke<void>("execute_git_commit", {
    repoId,
    message,
    amend,
  });
}

/**
 * Execute native git push in PTY streaming to active tab xterm
 */
export async function executeGitPushIpc(
  repoId: string,
  remote?: string,
  branch?: string,
  force: boolean = false,
  setUpstream: boolean = false
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] git push ${remote || ""} ${branch || ""} (force=${force}, setUpstream=${setUpstream})`);
    return;
  }
  return await invoke<void>("execute_git_push", {
    repoId,
    remote,
    branch,
    force,
    setUpstream,
  });
}

/**
 * Execute native git fetch in PTY streaming to active tab xterm with --prune
 */
export async function executeGitFetchIpc(
  repoId: string,
  remote?: string,
  prune: boolean = true
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] git fetch ${remote || "--all"} (prune=${prune})`);
    return;
  }
  return await invoke<void>("execute_git_fetch", {
    repoId,
    remote,
    prune,
  });
}

/**
 * Execute native git merge in PTY streaming to active tab xterm
 */
export async function executeGitMergeIpc(
  repoId: string,
  branch: string
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] git merge ${branch}`);
    return;
  }
  return await invoke<void>("execute_git_merge", {
    repoId,
    branch,
  });
}

/**
 * Silently fetch all remotes and prune in background
 */
export async function backgroundFetchRepositoryIpc(repoId: string): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] background_fetch_repository for ${repoId}`);
    return;
  }
  return await invoke<void>("background_fetch_repository", { repoId });
}

/**
 * Send SIGINT/kill to active PTY child process (e.g. aborting long-running hook)
 */
export async function cancelActiveProcessIpc(repoId: string): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] cancel_active_process for repo ${repoId}`);
    return;
  }
  return await invoke<void>("cancel_active_process", { repoId });
}

/**
 * Inspect Git client hooks in .git/hooks or core.hooksPath
 */
export async function getRepoHooksIpc(repoId: string): Promise<RepoHooksInfo> {
  if (!isTauriEnvironment()) {
    return {
      hooks_dir: ".git/hooks",
      has_pre_commit: true,
      has_commit_msg: false,
      has_pre_push: false,
      active_hooks: [
        {
          name: "pre-commit",
          path: ".git/hooks/pre-commit",
          is_executable: true,
        },
      ],
    };
  }
  return await invoke<RepoHooksInfo>("get_repo_hooks", { repoId });
}

/**
 * Execute a dry-run of a specific git hook in the PTY terminal
 */
export async function executeHookDryRunIpc(repoId: string, hookName: string): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] execute_hook_dry_run: ${hookName} in ${repoId}`);
    return;
  }
  return await invoke<void>("execute_hook_dry_run", { repoId, hookName });
}

/**
 * List linked worktrees for a repository session
 */
export async function listWorktreesIpc(repoId: string): Promise<WorktreeItem[]> {
  if (!isTauriEnvironment()) {
    return [
      {
        path: "/path/to/worktree/main",
        head: "a1b2c3d4",
        branch: "main",
        is_detached: false,
        is_locked: false,
        lock_reason: null,
        is_prunable: false,
        is_main: true,
      },
      {
        path: "/path/to/worktree/feature-branch",
        head: "e5f6g7h8",
        branch: "feature/worktree-ui",
        is_detached: false,
        is_locked: false,
        lock_reason: null,
        is_prunable: false,
        is_main: false,
      },
    ];
  }
  return await invoke<WorktreeItem[]>("list_worktrees", { repoId });
}

/**
 * Add a new linked worktree
 */
export async function addWorktreeIpc(
  repoId: string,
  path: string,
  branch: string,
  newBranch: boolean = false
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] add_worktree: ${path} (${branch})`);
    return;
  }
  return await invoke<void>("add_worktree", {
    repoId,
    path,
    branch,
    newBranch,
  });
}

/**
 * Remove a linked worktree
 */
export async function removeWorktreeIpc(
  repoId: string,
  path: string,
  force: boolean = false
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] remove_worktree: ${path} (force=${force})`);
    return;
  }
  return await invoke<void>("remove_worktree", {
    repoId,
    path,
    force,
  });
}

/**
 * Prune stale / orphaned worktree administrative data (git worktree prune)
 */
export async function pruneWorktreesIpc(repoId: string): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] prune_worktrees for ${repoId}`);
    return;
  }
  return await invoke<void>("prune_worktrees", { repoId });
}

/**
 * Calculate ahead/behind commit counts relative to upstream tracking branch
 */
export async function getRemoteSyncStatusIpc(
  repoId: string
): Promise<RemoteSyncStatus> {
  if (!isTauriEnvironment()) {
    return {
      current_branch: "main",
      upstream_branch: "origin/main",
      ahead: 1,
      behind: 0,
      has_upstream: true,
    };
  }
  return await invoke<RemoteSyncStatus>("get_remote_sync_status", { repoId });
}

/**
 * Execute native git pull in PTY
 */
export async function executeGitPullIpc(
  repoId: string,
  remote?: string,
  branch?: string,
  rebase: boolean = false
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] git pull ${remote || ""} ${branch || ""} (rebase=${rebase})`);
    return;
  }
  return await invoke<void>("execute_git_pull", {
    repoId,
    remote,
    branch,
    rebase,
  });
}

/**
 * Start streaming git clone in the background
 */
export async function startCloneRepositoryIpc(
  cloneId: string,
  options: CloneOptions
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] clone ${options.url} -> ${options.destination}`);
    return;
  }
  return await invoke<void>("start_clone_repository", {
    cloneId,
    options,
  });
}

/**
 * Cancel an active clone operation
 */
export async function cancelCloneIpc(cloneId: string): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] cancel_clone: ${cloneId}`);
    return;
  }
  return await invoke<void>("cancel_clone", { cloneId });
}

/**
 * Listen to real-time git clone progress events
 */
export async function listenToCloneProgress(
  cloneId: string,
  onProgress: (payload: CloneProgressPayload) => void
): Promise<UnlistenFn> {
  if (!isTauriEnvironment()) {
    return () => {};
  }
  return await listen<CloneProgressPayload>(`clone_progress:${cloneId}`, (event) => {
    onProgress(event.payload);
  });
}

/**
 * Query all local and remote branches in the repository
 */
export async function getRepoBranchesIpc(repoId: string): Promise<RepoBranches> {
  if (!isTauriEnvironment()) {
    return {
      local: [
        {
          name: "refs/heads/main",
          shorthand: "main",
          is_head: true,
          is_remote: false,
          upstream: "origin/main",
          target_commit: "mock-hash",
          ahead: 0,
          behind: 0,
          has_uncommitted: false,
        },
      ],
      remote: [
        {
          name: "refs/remotes/origin/main",
          shorthand: "origin/main",
          is_head: false,
          is_remote: true,
          upstream: null,
          target_commit: "mock-hash",
        },
      ],
    };
  }

  return await invoke<RepoBranches>("get_repo_branches", { repoId });
}

/**
 * Checkout target branch (local or remote tracking)
 */
export async function checkoutBranchIpc(repoId: string, branchName: string): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] checkout_branch: ${branchName} in ${repoId}`);
    return;
  }

  return await invoke<void>("checkout_branch", { repoId, branchName });
}

/**
 * Create a new branch
 */
export async function createBranchIpc(
  repoId: string,
  branchName: string,
  targetCommit?: string | null,
  checkout = true
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] create_branch: ${branchName} in ${repoId}`);
    return;
  }
  return await invoke<void>("create_branch", {
    repoId,
    branchName,
    targetCommit: targetCommit || null,
    checkout,
  });
}

/**
 * Delete a branch
 */
export async function deleteBranchIpc(
  repoId: string,
  branchName: string,
  isRemote = false
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] delete_branch: ${branchName} in ${repoId}`);
    return;
  }
  return await invoke<void>("delete_branch", { repoId, branchName, isRemote });
}

/**
 * Rename a local branch that is not yet pushed to origin
 */
export async function renameBranchIpc(
  repoId: string,
  oldName: string,
  newName: string
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] rename_branch: ${oldName} -> ${newName} in ${repoId}`);
    return;
  }
  return await invoke<void>("rename_branch", { repoId, oldName, newName });
}

/**
 * List repository stashes
 */
export async function listStashesIpc(repoId: string): Promise<StashItem[]> {
  if (!isTauriEnvironment()) {
    return [
      {
        index: 0,
        message: "WIP on main: preliminary styling tweaks",
        commit_id: "stash-hash-0",
      },
    ];
  }
  return await invoke<StashItem[]>("list_stashes", { repoId });
}

/**
 * Create a git stash
 */
export async function createStashIpc(
  repoId: string,
  message?: string | null,
  includeUntracked = true
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] create_stash: ${message} in ${repoId}`);
    return;
  }
  return await invoke<void>("create_stash", {
    repoId,
    message: message || null,
    includeUntracked,
  });
}

/**
 * Apply or pop a stash
 */
export async function applyStashIpc(
  repoId: string,
  index: number,
  pop = false
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] apply_stash: #${index} (pop: ${pop}) in ${repoId}`);
    return;
  }
  return await invoke<void>("apply_stash", { repoId, index, pop });
}

/**
 * Drop a stash
 */
export async function dropStashIpc(repoId: string, index: number): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] drop_stash: #${index} in ${repoId}`);
    return;
  }
  return await invoke<void>("drop_stash", { repoId, index });
}

/**
 * Get stash details and changed files
 */
export async function getStashDetailsIpc(
  repoId: string,
  stashIndex: number
): Promise<StashDetails> {
  if (!isTauriEnvironment()) {
    return {
      index: stashIndex,
      commit_id: `stash-oid-${stashIndex}`,
      message: `WIP on main: mock stash #${stashIndex}`,
      timestamp: Math.floor(Date.now() / 1000) - 1800,
      total_additions: 12,
      total_deletions: 4,
      files: [
        {
          path: "src/App.tsx",
          status: "modified",
          additions: 8,
          deletions: 4,
          is_untracked: false,
        },
        {
          path: "src/new-feature.ts",
          status: "untracked",
          additions: 4,
          deletions: 0,
          is_untracked: true,
        },
      ],
    };
  }
  return await invoke<StashDetails>("get_stash_details", {
    repoId,
    stashIndex,
  });
}

/**
 * Get file diff for a specific file inside a git stash
 */
export async function getStashFileDiffIpc(
  repoId: string,
  stashIndex: number,
  filePath: string
): Promise<FileDiff> {
  if (!isTauriEnvironment()) {
    return {
      old_path: filePath,
      new_path: filePath,
      is_binary: false,
      is_new: false,
      is_deleted: false,
      total_additions: 2,
      total_deletions: 1,
      hunks: [
        {
          header: "@@ -1,5 +1,6 @@",
          old_start: 1,
          old_lines: 5,
          new_start: 1,
          new_lines: 6,
          patch: "Mock stash diff patch",
          lines: [
            { origin: " ", content: "// existing header", old_lineno: 1, new_lineno: 1 },
            { origin: "-", content: "const oldVal = 1;", old_lineno: 2 },
            { origin: "+", content: "const newVal = 2;", new_lineno: 2 },
            { origin: "+", content: "const stashedVal = true;", new_lineno: 3 },
          ],
        },
      ],
    };
  }
  return await invoke<FileDiff>("get_stash_file_diff", {
    repoId,
    stashIndex,
    filePath,
  });
}

/**
 * Get commit details and changed files
 */
export async function getCommitDetailsIpc(
  repoId: string,
  commitSha: string
): Promise<CommitDetails> {
  if (!isTauriEnvironment()) {
    return {
      hash: commitSha,
      summary: "Mock commit summary for browser preview",
      body: "Mock details about this commit",
      author_name: "Mock Author",
      author_email: "author@gitshark.dev",
      timestamp: Math.floor(Date.now() / 1000) - 3600,
      parent_hashes: ["mock-parent-1"],
      files: [
        {
          path: "src/components/graph/CommitGraphCanvas.tsx",
          status: "modified",
          additions: 14,
          deletions: 3,
        },
        {
          path: "src-tauri/src/git.rs",
          status: "modified",
          additions: 42,
          deletions: 8,
        },
      ],
      total_additions: 56,
      total_deletions: 11,
    };
  }
  return await invoke<CommitDetails>("get_commit_details", { repoId, commitSha });
}

/**
 * Get structured FileDiff for a file in a historical commit
 */
export async function getCommitFileDiffIpc(
  repoId: string,
  commitSha: string,
  filePath: string
): Promise<import("@/types").FileDiffData> {
  if (!isTauriEnvironment()) {
    return {
      old_path: filePath,
      new_path: filePath,
      is_binary: false,
      is_new: false,
      is_deleted: false,
      hunks: [],
      total_additions: 0,
      total_deletions: 0,
    };
  }
  return await invoke<import("@/types").FileDiffData>("get_commit_file_diff", {
    repoId,
    commitSha,
    filePath,
  });
}

/**
 * List all tags in the repository
 */
export async function listTagsIpc(repoId: string): Promise<GitTagItem[]> {
  if (!isTauriEnvironment()) {
    return [
      {
        name: "v0.1.0",
        target_commit: "dca639e37c8ac38fca1f6d7e165b8a0c9eeeda1b",
        message: "Release v0.1.0",
        tagger: "GitShark User",
        tagger_date: Math.floor(Date.now() / 1000),
      },
    ];
  }
  return await invoke<GitTagItem[]>("list_tags", { repoId });
}

/**
 * Create a new tag on a target commit or HEAD
 */
export async function createTagIpc(
  repoId: string,
  tagName: string,
  targetCommit?: string,
  message?: string
): Promise<GitTagItem> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] create_tag: ${tagName} (commit: ${targetCommit || "HEAD"})`);
    return {
      name: tagName,
      target_commit: targetCommit || "dca639e37c8ac38fca1f6d7e165b8a0c9eeeda1b",
      message: message || null,
      tagger: "Browser User",
      tagger_date: Math.floor(Date.now() / 1000),
    };
  }
  return await invoke<GitTagItem>("create_tag", {
    repoId,
    tagName,
    targetCommit,
    message,
  });
}

/**
 * Delete a tag from the local repository
 */
export async function deleteTagIpc(repoId: string, tagName: string): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] delete_tag: ${tagName}`);
    return;
  }
  return await invoke<void>("delete_tag", { repoId, tagName });
}

/**
 * Push a tag to remote origin via PTY streaming
 */
export async function pushTagIpc(
  repoId: string,
  tagName: string,
  remote?: string
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] push_tag: ${tagName} to ${remote || "origin"}`);
    return;
  }
  return await invoke<void>("push_tag", { repoId, tagName, remote });
}

/**
 * Pick an executable file (e.g. git.exe on Windows, git on Unix)
 */
export async function pickGitExecutable(): Promise<string | null> {
  try {
    const selected = await openDialog({
      directory: false,
      multiple: false,
      title: "Select Git Executable (git.exe)",
      filters: [
        {
          name: "Git Executable",
          extensions: ["exe", "cmd", "*"],
        },
      ],
    });

    if (Array.isArray(selected)) {
      return selected[0] ?? null;
    }
    return selected;
  } catch (err) {
    console.error("Failed to open file picker for git executable:", err);
    return null;
  }
}

/**
 * Get current Git binary resolution info (auto-detected vs custom)
 */
export async function getGitBinaryInfoIpc(): Promise<GitBinaryInfo> {
  if (!isTauriEnvironment()) {
    return {
      current_path: "C:\\Program Files\\Git\\cmd\\git.exe",
      is_custom: false,
      auto_detected_path: "C:\\Program Files\\Git\\cmd\\git.exe",
      version: "git version 2.48.1.windows.1 (Simulated)",
      is_valid: true,
    };
  }
  return await invoke<GitBinaryInfo>("get_git_binary_info");
}

/**
 * Validate an arbitrary Git executable path
 */
export async function validateGitPathIpc(path: string): Promise<string> {
  if (!isTauriEnvironment()) {
    if (path.toLowerCase().includes("git")) {
      return "git version 2.48.1.windows.1 (Simulated)";
    }
    throw new Error("Specified path is not a valid Git executable");
  }
  return await invoke<string>("validate_git_path", { path });
}

/**
 * Set or reset custom Git executable path
 */
export async function setCustomGitPathIpc(path: string | null): Promise<GitBinaryInfo> {
  if (!isTauriEnvironment()) {
    return {
      current_path: path || "C:\\Program Files\\Git\\cmd\\git.exe",
      is_custom: Boolean(path),
      auto_detected_path: "C:\\Program Files\\Git\\cmd\\git.exe",
      version: "git version 2.48.1.windows.1 (Simulated)",
      is_valid: true,
    };
  }
  return await invoke<GitBinaryInfo>("set_custom_git_path", { path });
}

/**
 * Set the filesystem watcher debounce delay window in milliseconds
 */
export async function setDiffDebounceDelayIpc(delayMs: number): Promise<number> {
  if (!isTauriEnvironment()) {
    return delayMs;
  }
  return await invoke<number>("set_diff_debounce_delay", { delayMs });
}

/**
 * Get the current filesystem watcher debounce delay window in milliseconds
 */
export async function getDiffDebounceDelayIpc(): Promise<number> {
  if (!isTauriEnvironment()) {
    return 1500;
  }
  return await invoke<number>("get_diff_debounce_delay");
}

/**
 * Query the remote URL for a repository
 */
export async function getRepositoryRemoteUrlIpc(
  repoId: string,
  remote?: string
): Promise<string | null> {
  if (!isTauriEnvironment()) {
    return "https://github.com/whitesoup12/gitshark.git";
  }
  return await invoke<string | null>("get_repository_remote_url", { id: repoId, remote });
}

/**
 * Open an external URL in the default system web browser
 */
export async function openInBrowserIpc(url: string): Promise<void> {
  if (!isTauriEnvironment()) {
    window.open(url, "_blank");
    return;
  }
  return await invoke<void>("open_in_browser", { url });
}

/**
 * Execute git cherry-pick <commitSha> in PTY
 */
export async function executeGitCherryPickIpc(
  repoId: string,
  commitSha: string
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] git cherry-pick ${commitSha}`);
    return;
  }
  return await invoke<void>("execute_git_cherry_pick", { repoId, commitSha });
}

/**
 * Execute git revert --no-edit <commitSha> in PTY
 */
export async function executeGitRevertIpc(
  repoId: string,
  commitSha: string
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] git revert --no-edit ${commitSha}`);
    return;
  }
  return await invoke<void>("execute_git_revert", { repoId, commitSha });
}

/**
 * Checkout a commit SHA in detached HEAD state
 */
export async function checkoutCommitIpc(
  repoId: string,
  commitSha: string
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] checkout_commit ${commitSha}`);
    return;
  }
  return await invoke<void>("checkout_commit", { repoId, commitSha });
}

/**
 * Reset current branch / HEAD to a target commit SHA (soft, mixed, hard)
 */
export async function resetToCommitIpc(
  repoId: string,
  commitSha: string,
  mode: "soft" | "mixed" | "hard"
): Promise<void> {
  if (!isTauriEnvironment()) {
    console.log(`[Browser Sim] git reset --${mode} ${commitSha}`);
    return;
  }
  return await invoke<void>("reset_to_commit", { repoId, commitSha, mode });
}

export interface SharkStatsData {
  commits_swum: number;
  changes_chomped: number;
  pushes_launched: number;
  stashes_buried: number;
  merges_to_main?: number;
  prs_opened?: number;
  storage_path?: string;
  exists?: boolean;
}

/**
 * Load persistent Shark Stats from ~/.gitshark/shark_stats.json in user's home profile
 */
export async function getSharkStatsIpc(): Promise<SharkStatsData> {
  if (!isTauriEnvironment()) {
    return {
      commits_swum: 0,
      changes_chomped: 0,
      pushes_launched: 0,
      stashes_buried: 0,
      merges_to_main: 0,
      storage_path: "~/.gitshark/shark_stats.json",
    };
  }
  return await invoke<SharkStatsData>("get_shark_stats");
}

/**
 * Save persistent Shark Stats to ~/.gitshark/shark_stats.json in user's home profile
 */
export async function saveSharkStatsIpc(
  stats: SharkStatsData
): Promise<SharkStatsData> {
  if (!isTauriEnvironment()) {
    return stats;
  }
  return await invoke<SharkStatsData>("save_shark_stats", { stats });
}

/**
 * Retrieve Git credentials / token for remote host (e.g. github.com)
 */
export async function getGitAuthTokenIpc(host?: string): Promise<string | null> {
  if (!isTauriEnvironment()) {
    return null;
  }
  return await invoke<string | null>("get_git_auth_token", { host });
}

export interface OpenReposSession {
  open_paths: string[];
  active_path: string | null;
}

const STORAGE_SAVED_OPEN_REPOS = "gitshark_saved_open_repos";

/**
 * Load persistent open repositories session from ~/.gitshark/open_repos.json
 */
export async function getSavedOpenReposIpc(): Promise<OpenReposSession> {
  if (!isTauriEnvironment()) {
    try {
      const raw = localStorage.getItem(STORAGE_SAVED_OPEN_REPOS);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return { open_paths: [], active_path: null };
  }

  try {
    const session = await invoke<OpenReposSession>("get_saved_open_repos");
    return session || { open_paths: [], active_path: null };
  } catch (err) {
    console.warn("Failed to get saved open repos from disk:", err);
    try {
      const raw = localStorage.getItem(STORAGE_SAVED_OPEN_REPOS);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return { open_paths: [], active_path: null };
  }
}

/**
 * Persist currently open repositories session to ~/.gitshark/open_repos.json
 */
export async function saveOpenReposIpc(session: OpenReposSession): Promise<void> {
  try {
    localStorage.setItem(STORAGE_SAVED_OPEN_REPOS, JSON.stringify(session));
  } catch {
    // ignore
  }

  if (!isTauriEnvironment()) {
    return;
  }

  return await invoke<void>("save_open_repos", { session });
}



