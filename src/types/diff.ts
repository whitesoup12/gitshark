export interface FileStatusItem {
  path: string;
  status: "modified" | "new" | "deleted" | "renamed" | "typechange" | "untracked" | string;
  staged: boolean;
}

export interface WorkingTreeStatus {
  staged: FileStatusItem[];
  unstaged: FileStatusItem[];
  untracked: FileStatusItem[];
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

