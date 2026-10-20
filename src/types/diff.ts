export interface FileStatusItem {
  path: string;
  status: "modified" | "new" | "deleted" | "renamed" | "typechange" | "untracked" | "conflicted" | string;
  staged: boolean;
}

export interface WorkingTreeStatus {
  staged: FileStatusItem[];
  unstaged: FileStatusItem[];
  untracked: FileStatusItem[];
  conflicted?: FileStatusItem[];
  repo_state?: "clean" | "merge" | "rebase" | "cherry_pick" | "revert" | "bisect" | "apply_mailbox" | string;
  repo_state_label?: string | null;
}

export interface ConflictBlock {
  id: number;
  ours_header: string;
  ours_content: string;
  base_content?: string | null;
  theirs_content: string;
  theirs_header: string;
  start_line: number;
  end_line: number;
}

export interface ConflictFileDetails {
  path: string;
  full_content: string;
  ours_content?: string | null;
  theirs_content?: string | null;
  base_content?: string | null;
  blocks: ConflictBlock[];
  is_binary: boolean;
  has_conflict_markers: boolean;
}

export interface DiffLine {
  origin: "+" | "-" | " ";
  old_lineno?: number | null;
  new_lineno?: number | null;
  content: string;
}

export interface DiffHunk {
  header: string;
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  patch: string;
  lines: DiffLine[];
}

export interface FileDiff {
  old_path?: string | null;
  new_path?: string | null;
  is_binary: boolean;
  is_new: boolean;
  is_deleted: boolean;
  hunks: DiffHunk[];
  total_additions: number;
  total_deletions: number;
}

export type FileDiffData = FileDiff;

export interface BlameHunkItem {
  commit_id: string;
  commit_summary: string;
  author_name: string;
  author_email: string;
  timestamp: number;
  start_line: number;
  lines_in_hunk: number;
}

export interface FileBlameData {
  path: string;
  is_binary: boolean;
  lines: string[];
  hunks: BlameHunkItem[];
}

export interface FileHistoryItem {
  commit_hash: string;
  summary: string;
  author_name: string;
  author_email: string;
  timestamp: number;
  additions: number;
  deletions: number;
}

