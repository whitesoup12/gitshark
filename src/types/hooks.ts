export type HookStatus = "idle" | "running" | "passed" | "failed" | "aborted";

export type HookStage =
  | "idle"
  | "pre-commit"
  | "commit-msg"
  | "post-commit"
  | "pre-push"
  | "committing"
  | "pushing";

export interface HookDetail {
  name: string;
  path: string;
  is_executable: boolean;
}

export interface RepoHooksInfo {
  hooks_dir: string;
  has_pre_commit: boolean;
  has_commit_msg: boolean;
  has_pre_push: boolean;
  active_hooks: HookDetail[];
}

export interface HookExecutionState {
  stage: HookStage;
  status: HookStatus;
  elapsedSeconds: number;
  lastCommand: "commit" | "push" | "pull" | "merge" | null;
  lastMessage?: string;
  lastAmend?: boolean;
  exitCode?: number | null;
  error?: string | null;
}
