import { CommitFileChange } from "./graph";

export interface ComparisonCommitItem {
  hash: string;
  summary: string;
  body?: string | null;
  author_name: string;
  author_email: string;
  timestamp: number;
}

export interface BranchComparisonDetails {
  base_ref: string;
  compare_ref: string;
  base_commit: string;
  compare_commit: string;
  merge_base_commit: string;
  ahead: number;
  behind: number;
  total_additions: number;
  total_deletions: number;
  files: CommitFileChange[];
  commits: ComparisonCommitItem[];
}
