export interface GitBinaryInfo {
  current_path: string;
  is_custom: boolean;
  auto_detected_path: string;
  version: string | null;
  is_valid: boolean;
}

export type SettingsTab = "git" | "terminal" | "appearance" | "about";
