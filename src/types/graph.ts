export interface GitRefBadge {
  name: string;
  shorthand: string;
  kind: "head" | "detached" | "local_branch" | "remote_branch" | "tag" | string;
  is_head: boolean;
}

export interface Edge {
  from_lane: number;
  to_lane: number;
  to_row: number;
  is_merge: boolean;
  color_index: number;
}

export interface CommitNode {
  id: string;
  summary: string;
  author: string;
  author_email: string;
  timestamp: number;
  hash: string;
  parents: string[];
  lane: number;
  color_index: number;
  edges: Edge[];
  refs: GitRefBadge[];
}

export interface CommitFileChange {
  path: string;
  old_path?: string | null;
  status: "added" | "deleted" | "modified" | "renamed" | string;
  additions: number;
  deletions: number;
}

export interface CommitDetails {
  hash: string;
  summary: string;
  body?: string | null;
  author_name: string;
  author_email: string;
  timestamp: number;
  parent_hashes: string[];
  files: CommitFileChange[];
  total_additions: number;
  total_deletions: number;
}

