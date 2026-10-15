export interface WorktreeItem {
  path: string;
  head: string | null;
  branch: string | null;
  is_detached: boolean;
  is_locked: boolean;
  lock_reason: string | null;
  is_prunable: boolean;
  is_main: boolean;
}
