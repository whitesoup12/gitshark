/**
 * Core repository metadata returned by git2 inspection in Rust backend
 */
export interface RepoMetadata {
  id: string;
  name: string;
  path: string;
  current_branch: string | null;
  is_detached: boolean;
  head_commit_hash: string | null;
  head_commit_summary: string | null;
  is_dirty: boolean;
  staged_count: number;
  unstaged_count: number;
  untracked_count: number;
}

export interface BranchItem {
  name: string;
  shorthand: string;
  is_head: boolean;
  is_remote: boolean;
  upstream?: string | null;
  target_commit?: string | null;
  ahead?: number;
  behind?: number;
  has_uncommitted?: boolean;
}

export interface RepoBranches {
  local: BranchItem[];
  remote: BranchItem[];
}

export interface GitBranch {
  name: string;
  isRemote: boolean;
  isHead: boolean;
  upstream?: string;
}

export interface GitCommitRef {
  hash: string;
  shortHash: string;
  summary: string;
  author: string;
  timestamp: number;
  parentHashes: string[];
}

export interface StashItem {
  index: number;
  message: string;
  commit_id: string;
}

export interface GitTagItem {
  name: string;
  target_commit: string;
  message?: string | null;
  tagger?: string | null;
  tagger_date?: number | null;
}

