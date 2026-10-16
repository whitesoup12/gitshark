export interface RemoteSyncStatus {
  current_branch: string | null;
  upstream_branch: string | null;
  ahead: number;
  behind: number;
  has_upstream: boolean;
}

export interface CloneOptions {
  url: string;
  destination: string;
  branch?: string;
  depth?: number;
  recurse_submodules: boolean;
}

export interface CloneProgressPayload {
  clone_id: string;
  stage: string;
  percentage: number;
  raw_line: string;
  is_complete: boolean;
  error?: string | null;
}

export interface PullRequestInfo {
  number: number;
  title: string;
  url: string;
  state: "open" | "closed" | "merged";
  is_draft: boolean;
  source_branch: string;
  target_branch: string;
  author?: string;
  author_avatar?: string;
  updated_at?: string;
  comments_count?: number;
}
