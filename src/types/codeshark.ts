export interface CodeSharkDirEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number | null;
}

export interface CodeSharkPathInfo {
  path: string;
  name: string;
  is_dir: boolean;
  exists: boolean;
}

export interface ProjectRoot {
  id: string;
  name: string;
  path: string;
  isExpanded: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  size?: number | null;
  children?: FileTreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
  loaded?: boolean;
}

export interface OpenFileTab {
  id: string;
  path: string;
  name: string;
  content: string;
  originalContent: string;
  gitHeadContent?: string;
  isDirty: boolean;
  language: string;
  projectId?: string;
}

export interface WorkspaceContentMatch {
  file_path: string;
  file_name: string;
  relative_path: string;
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
}

export interface SearchWorkspaceContentOptions {
  root_paths: string[];
  query: string;
  case_sensitive: boolean;
  whole_word: boolean;
  is_regex: boolean;
  include_pattern?: string;
  exclude_pattern?: string;
  max_results?: number;
}

export interface WorkspaceReplaceOptions {
  root_paths: string[];
  query: string;
  replacement: string;
  case_sensitive: boolean;
  whole_word: boolean;
  is_regex: boolean;
  include_pattern?: string;
  exclude_pattern?: string;
  target_files?: string[];
}

export interface WorkspaceReplaceSummary {
  files_modified: number;
  occurrences_replaced: number;
  modified_files: string[];
}

export interface WorkspaceFileMatch {
  path: string;
  name: string;
  relative_path: string;
  is_dir: boolean;
}
