export interface GitBinaryInfo {
  current_path: string;
  is_custom: boolean;
  auto_detected_path: string;
  version: string | null;
  is_valid: boolean;
}

export type SettingsTab = "git" | "terminal" | "appearance" | "about";

export type DiffRefreshDelayOption = 500 | 1000 | 1500 | 2500 | 4000;

export type PushTagsOption = "none" | "follow-tags" | "all";

export type ThemeId =
  | "shark-dark"
  | "abyssal"
  | "dracula"
  | "tokyo-night"
  | "nord"
  | "one-dark"
  | "daylight-reef";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  type: "dark" | "light";
  primaryBg: string;
  secondaryBg: string;
  accent: string;
  text: string;
  monacoTheme: string;
}
