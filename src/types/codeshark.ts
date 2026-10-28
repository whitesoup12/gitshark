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
