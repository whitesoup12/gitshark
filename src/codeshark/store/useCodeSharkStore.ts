import { create } from "zustand";
import type {
  ProjectRoot,
  FileTreeNode,
  OpenFileTab,
  WorkspaceContentMatch,
  WorkspaceFileMatch,
} from "@/types";
import {
  getPathInfoIpc,
  readDirEntriesIpc,
  readTextFileIpc,
  writeTextFileIpc,
  getRepoGitStatusIpc,
  getFileGitHeadContentIpc,
  createCodeSharkFileIpc,
  createCodeSharkDirIpc,
  renameCodeSharkPathIpc,
  deleteCodeSharkPathIpc,
  revealInFileManagerIpc,
  searchWorkspaceContentIpc,
  replaceWorkspaceContentIpc,
  searchWorkspaceFilesIpc,
} from "@/lib/ipc";
import { detectLanguageByFilename, normalizePath } from "../utils/language";

const STORAGE_QUIET_LINTING = "codeshark_quiet_linting";

const getInitialQuietLinting = (): boolean => {
  try {
    const saved = localStorage.getItem(STORAGE_QUIET_LINTING);
    if (saved !== null) {
      return saved === "true";
    }
  } catch {
    // ignore
  }
  return true; // Default to true: clean syntax without squigglies/linting
};

function getParentDir(pathStr: string): string {
  const norm = normalizePath(pathStr);
  const lastSlash = norm.lastIndexOf("/");
  return lastSlash > 0 ? norm.slice(0, lastSlash) : norm;
}

export interface JumpLocation {
  filePath: string;
  line: number;
  col?: number;
  endCol?: number;
  timestamp: number;
}

// Global in-flight set to prevent concurrent duplicate file opens (e.g. from rapid events or strict-mode mounts)
const inFlightOpeningFiles = new Set<string>();

interface CodeSharkState {
  projects: ProjectRoot[];
  expandedFolders: Record<string, boolean>;
  treeNodes: Record<string, FileTreeNode[]>;
  loadingFolders: Record<string, boolean>;
  projectGitStatus: Record<string, Record<string, string>>;
  openTabs: OpenFileTab[];
  activeFilePath: string | null;
  sidebarOpen: boolean;
  sidebarWidth: number;
  isSaving: boolean;
  statusMessage: string | null;
  cursorPos: { line: number; col: number };

  // Sidebar Tab: files or search
  sidebarTab: "files" | "search";
  setSidebarTab: (tab: "files" | "search") => void;

  // Global Search & Replace
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  replaceQuery: string;
  setReplaceQuery: (r: string) => void;
  isReplaceOpen: boolean;
  toggleReplaceOpen: () => void;
  searchCaseSensitive: boolean;
  toggleSearchCaseSensitive: () => void;
  searchWholeWord: boolean;
  toggleSearchWholeWord: () => void;
  searchIsRegex: boolean;
  toggleSearchIsRegex: () => void;
  searchIncludePattern: string;
  setSearchIncludePattern: (p: string) => void;
  searchExcludePattern: string;
  setSearchExcludePattern: (p: string) => void;
  searchResults: WorkspaceContentMatch[];
  isSearching: boolean;
  searchSummary: { filesCount: number; matchCount: number } | null;
  executeGlobalSearch: () => Promise<void>;
  clearGlobalSearch: () => void;
  executeGlobalReplace: () => Promise<void>;
  replaceSingleMatch: (match: WorkspaceContentMatch) => Promise<void>;

  // Quick Open (File finder)
  quickOpenOpen: boolean;
  quickOpenQuery: string;
  quickOpenResults: WorkspaceFileMatch[];
  isQuickOpenSearching: boolean;
  openQuickOpen: () => void;
  closeQuickOpen: () => void;
  setQuickOpenQuery: (q: string) => void;
  executeQuickOpenFileSearch: (q: string) => Promise<void>;

  // In-File Find and Replace
  inFileFindOpen: boolean;
  inFileReplaceOpen: boolean;
  inFileQuery: string;
  inFileReplaceWith: string;
  inFileMatchIndex: number;
  inFileTotalMatches: number;
  inFileCaseSensitive: boolean;
  inFileWholeWord: boolean;
  inFileIsRegex: boolean;
  openInFileFind: (withReplace?: boolean, initialQuery?: string) => void;
  closeInFileFind: () => void;
  setInFileQuery: (q: string) => void;
  setInFileReplaceWith: (r: string) => void;
  toggleInFileReplace: () => void;
  toggleInFileCaseSensitive: () => void;
  toggleInFileWholeWord: () => void;
  toggleInFileIsRegex: () => void;
  setInFileMatchStatus: (index: number, total: number) => void;

  // Jump to location (for search navigation)
  jumpToLocation: JumpLocation | null;
  setJumpToLocation: (loc: Omit<JumpLocation, "timestamp"> | null) => void;

  // Filesystem Actions
  createFile: (folderPath: string, fileName: string) => Promise<void>;
  createDirectory: (folderPath: string, dirName: string) => Promise<void>;
  renamePath: (oldPath: string, newName: string) => Promise<void>;
  deletePath: (targetPath: string, isDir?: boolean) => Promise<void>;
  duplicateFile: (filePath: string) => Promise<void>;
  revealInFileManager: (targetPath: string) => Promise<void>;

  // Tab & Editor Actions
  initFromPath: (targetPath?: string) => Promise<void>;
  openTarget: (targetPath: string) => Promise<void>;
  addProjectFolder: (dirPath: string) => Promise<void>;
  removeProject: (projectId: string) => void;
  loadFolderEntries: (folderPath: string) => Promise<void>;
  toggleFolder: (folderPath: string) => Promise<void>;
  openFile: (filePath: string, name?: string, projectId?: string) => Promise<void>;
  closeTab: (tabIdOrPath: string) => void;
  closeOtherTabs: (tabIdOrPath: string) => void;
  closeTabsToTheRight: (tabIdOrPath: string) => void;
  closeAllTabs: () => void;
  saveAllFiles: () => Promise<void>;
  updateFileContent: (filePath: string, content: string) => void;
  saveFile: (filePath?: string) => Promise<void>;
  quietLinting: boolean;
  toggleQuietLinting: () => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  refreshGitStatus: (projectId?: string) => Promise<void>;
  setCursorPos: (line: number, col: number) => void;
  setStatusMessage: (msg: string | null) => void;
}

export const useCodeSharkStore = create<CodeSharkState>((set, get) => ({
  projects: [],
  expandedFolders: {},
  treeNodes: {},
  loadingFolders: {},
  projectGitStatus: {},
  openTabs: [],
  activeFilePath: null,
  sidebarOpen: true,
  sidebarWidth: 280,
  isSaving: false,
  statusMessage: null,
  cursorPos: { line: 1, col: 1 },

  sidebarTab: "files",
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),

  // Global search state
  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  replaceQuery: "",
  setReplaceQuery: (replaceQuery) => set({ replaceQuery }),
  isReplaceOpen: false,
  toggleReplaceOpen: () => set((s) => ({ isReplaceOpen: !s.isReplaceOpen })),
  searchCaseSensitive: false,
  toggleSearchCaseSensitive: () => set((s) => ({ searchCaseSensitive: !s.searchCaseSensitive })),
  searchWholeWord: false,
  toggleSearchWholeWord: () => set((s) => ({ searchWholeWord: !s.searchWholeWord })),
  searchIsRegex: false,
  toggleSearchIsRegex: () => set((s) => ({ searchIsRegex: !s.searchIsRegex })),
  searchIncludePattern: "",
  setSearchIncludePattern: (searchIncludePattern) => set({ searchIncludePattern }),
  searchExcludePattern: "",
  setSearchExcludePattern: (searchExcludePattern) => set({ searchExcludePattern }),
  searchResults: [],
  isSearching: false,
  searchSummary: null,

  executeGlobalSearch: async () => {
    const q = get().searchQuery;
    if (!q || q.trim().length === 0) {
      set({ searchResults: [], searchSummary: null });
      return;
    }
    const rootPaths = get().projects.map((p) => p.path);
    if (rootPaths.length === 0) {
      set({ statusMessage: "No workspace projects open to search" });
      return;
    }

    set({ isSearching: true });
    try {
      const results = await searchWorkspaceContentIpc({
        root_paths: rootPaths,
        query: q,
        case_sensitive: get().searchCaseSensitive,
        whole_word: get().searchWholeWord,
        is_regex: get().searchIsRegex,
        include_pattern: get().searchIncludePattern || undefined,
        exclude_pattern: get().searchExcludePattern || undefined,
        max_results: 1500,
      });

      const uniqueFiles = new Set(results.map((r) => r.file_path)).size;
      set({
        searchResults: results,
        isSearching: false,
        searchSummary: { filesCount: uniqueFiles, matchCount: results.length },
        statusMessage: `Found ${results.length} matches across ${uniqueFiles} files`,
      });
    } catch (err) {
      console.error("Global search failed:", err);
      set({ isSearching: false, statusMessage: `Search error: ${String(err)}` });
    }
  },

  clearGlobalSearch: () => {
    set({ searchQuery: "", searchResults: [], searchSummary: null });
  },

  executeGlobalReplace: async () => {
    const {
      searchQuery,
      replaceQuery,
      searchCaseSensitive,
      searchWholeWord,
      searchIsRegex,
      searchIncludePattern,
      searchExcludePattern,
    } = get();
    if (!searchQuery) return;
    const rootPaths = get().projects.map((p) => p.path);
    if (rootPaths.length === 0) return;

    set({ isSearching: true });
    try {
      const summary = await replaceWorkspaceContentIpc({
        root_paths: rootPaths,
        query: searchQuery,
        replacement: replaceQuery,
        case_sensitive: searchCaseSensitive,
        whole_word: searchWholeWord,
        is_regex: searchIsRegex,
        include_pattern: searchIncludePattern || undefined,
        exclude_pattern: searchExcludePattern || undefined,
      });

      // Reload any open tabs whose files were modified
      for (const modPath of summary.modified_files) {
        const normMod = normalizePath(modPath);
        const openTab = get().openTabs.find((t) => normalizePath(t.path) === normMod);
        if (openTab) {
          try {
            const updated = await readTextFileIpc(openTab.path);
            set((state) => ({
              openTabs: state.openTabs.map((t) =>
                normalizePath(t.path) === normMod
                  ? { ...t, content: updated, originalContent: updated, isDirty: false }
                  : t
              ),
            }));
          } catch {
            // ignore
          }
        }
      }

      set({
        isSearching: false,
        statusMessage: `Replaced ${summary.occurrences_replaced} occurrences in ${summary.files_modified} files`,
      });

      // Refresh search results
      await get().executeGlobalSearch();
      get().refreshGitStatus();
    } catch (err) {
      console.error("Global replace failed:", err);
      set({ isSearching: false, statusMessage: `Replace error: ${String(err)}` });
    }
  },

  replaceSingleMatch: async (match: WorkspaceContentMatch) => {
    try {
      await replaceWorkspaceContentIpc({
        root_paths: [match.file_path],
        query: get().searchQuery,
        replacement: get().replaceQuery,
        case_sensitive: get().searchCaseSensitive,
        whole_word: get().searchWholeWord,
        is_regex: get().searchIsRegex,
        target_files: [match.file_path],
      });

      const normMod = normalizePath(match.file_path);
      const openTab = get().openTabs.find((t) => normalizePath(t.path) === normMod);
      if (openTab) {
        const updated = await readTextFileIpc(openTab.path);
        set((state) => ({
          openTabs: state.openTabs.map((t) =>
            normalizePath(t.path) === normMod
              ? { ...t, content: updated, originalContent: updated, isDirty: false }
              : t
          ),
        }));
      }

      set({ statusMessage: `Replaced in ${match.file_name}` });
      await get().executeGlobalSearch();
      get().refreshGitStatus();
    } catch (err) {
      set({ statusMessage: `Error replacing match: ${String(err)}` });
    }
  },

  // Quick Open state & actions
  quickOpenOpen: false,
  quickOpenQuery: "",
  quickOpenResults: [],
  isQuickOpenSearching: false,

  openQuickOpen: () => {
    set({ quickOpenOpen: true, quickOpenQuery: "", quickOpenResults: [] });
    get().executeQuickOpenFileSearch("");
  },
  closeQuickOpen: () => set({ quickOpenOpen: false, quickOpenQuery: "", quickOpenResults: [] }),
  setQuickOpenQuery: (q) => {
    set({ quickOpenQuery: q });
    get().executeQuickOpenFileSearch(q);
  },
  executeQuickOpenFileSearch: async (q: string) => {
    const rootPaths = get().projects.map((p) => p.path);
    if (rootPaths.length === 0) return;
    set({ isQuickOpenSearching: true });
    try {
      const results = await searchWorkspaceFilesIpc(rootPaths, q, 100);
      set({ quickOpenResults: results, isQuickOpenSearching: false });
    } catch (err) {
      console.warn("Quick open search error:", err);
      set({ isQuickOpenSearching: false });
    }
  },

  // In-File Find and Replace
  inFileFindOpen: false,
  inFileReplaceOpen: false,
  inFileQuery: "",
  inFileReplaceWith: "",
  inFileMatchIndex: 0,
  inFileTotalMatches: 0,
  inFileCaseSensitive: false,
  inFileWholeWord: false,
  inFileIsRegex: false,

  openInFileFind: (withReplace?: boolean, initialQuery?: string) => {
    set((state) => ({
      inFileFindOpen: true,
      inFileReplaceOpen: withReplace !== undefined ? withReplace : state.inFileReplaceOpen,
      inFileQuery: initialQuery !== undefined ? initialQuery : state.inFileQuery,
    }));
  },
  closeInFileFind: () => set({ inFileFindOpen: false, inFileReplaceOpen: false }),
  setInFileQuery: (inFileQuery) => set({ inFileQuery }),
  setInFileReplaceWith: (inFileReplaceWith) => set({ inFileReplaceWith }),
  toggleInFileReplace: () => set((s) => ({ inFileReplaceOpen: !s.inFileReplaceOpen })),
  toggleInFileCaseSensitive: () => set((s) => ({ inFileCaseSensitive: !s.inFileCaseSensitive })),
  toggleInFileWholeWord: () => set((s) => ({ inFileWholeWord: !s.inFileWholeWord })),
  toggleInFileIsRegex: () => set((s) => ({ inFileIsRegex: !s.inFileIsRegex })),
  setInFileMatchStatus: (inFileMatchIndex, inFileTotalMatches) =>
    set({ inFileMatchIndex, inFileTotalMatches }),

  jumpToLocation: null,
  setJumpToLocation: (loc) =>
    set({
      jumpToLocation: loc ? { ...loc, timestamp: Date.now() } : null,
    }),

  // Filesystem actions
  createFile: async (folderPath: string, fileName: string) => {
    try {
      const normFolder = normalizePath(folderPath);
      const cleanName = fileName.trim();
      const targetPath = `${normFolder}/${cleanName}`;
      await createCodeSharkFileIpc(targetPath);
      await get().loadFolderEntries(normFolder);
      set((state) => ({
        expandedFolders: { ...state.expandedFolders, [normFolder]: true },
        statusMessage: `Created ${cleanName}`,
      }));
      await get().openFile(targetPath, cleanName);
      get().refreshGitStatus();
    } catch (err) {
      set({ statusMessage: `Failed to create file: ${String(err)}` });
    }
  },

  createDirectory: async (folderPath: string, dirName: string) => {
    try {
      const normFolder = normalizePath(folderPath);
      const cleanName = dirName.trim();
      const targetPath = `${normFolder}/${cleanName}`;
      await createCodeSharkDirIpc(targetPath);
      await get().loadFolderEntries(normFolder);
      set((state) => ({
        expandedFolders: { ...state.expandedFolders, [normFolder]: true, [targetPath]: true },
        statusMessage: `Created folder ${cleanName}`,
      }));
    } catch (err) {
      set({ statusMessage: `Failed to create folder: ${String(err)}` });
    }
  },

  renamePath: async (oldPath: string, newName: string) => {
    try {
      const normOld = normalizePath(oldPath);
      const parentDir = getParentDir(normOld);
      const cleanName = newName.trim();
      const newPath = `${parentDir}/${cleanName}`;
      await renameCodeSharkPathIpc(normOld, newPath);

      // Update open tabs if affected
      set((state) => ({
        openTabs: state.openTabs.map((tab) => {
          const tabNorm = normalizePath(tab.path);
          if (tabNorm === normOld) {
            return { ...tab, path: newPath, name: cleanName };
          }
          if (tabNorm.startsWith(normOld + "/")) {
            const suffix = tabNorm.slice(normOld.length);
            return { ...tab, path: newPath + suffix };
          }
          return tab;
        }),
        activeFilePath:
          state.activeFilePath && normalizePath(state.activeFilePath) === normOld
            ? newPath
            : state.activeFilePath && normalizePath(state.activeFilePath).startsWith(normOld + "/")
            ? newPath + normalizePath(state.activeFilePath).slice(normOld.length)
            : state.activeFilePath,
        statusMessage: `Renamed to ${cleanName}`,
      }));

      await get().loadFolderEntries(parentDir);
      get().refreshGitStatus();
    } catch (err) {
      set({ statusMessage: `Failed to rename: ${String(err)}` });
    }
  },

  deletePath: async (targetPath: string) => {
    try {
      const normTarget = normalizePath(targetPath);
      const parentDir = getParentDir(normTarget);
      await deleteCodeSharkPathIpc(normTarget);

      // Close affected tabs
      const remainingTabs = get().openTabs.filter((tab) => {
        const tabNorm = normalizePath(tab.path);
        return tabNorm !== normTarget && !tabNorm.startsWith(normTarget + "/");
      });

      let nextActive = get().activeFilePath;
      if (nextActive) {
        const activeNorm = normalizePath(nextActive);
        if (activeNorm === normTarget || activeNorm.startsWith(normTarget + "/")) {
          nextActive = remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1].path : null;
        }
      }

      set({
        openTabs: remainingTabs,
        activeFilePath: nextActive,
        statusMessage: `Deleted ${normTarget.split("/").pop()}`,
      });

      await get().loadFolderEntries(parentDir);
      get().refreshGitStatus();
    } catch (err) {
      set({ statusMessage: `Failed to delete: ${String(err)}` });
    }
  },

  duplicateFile: async (filePath: string) => {
    try {
      const normFile = normalizePath(filePath);
      const parentDir = getParentDir(normFile);
      const fileName = normFile.split("/").pop() || "file";
      const parts = fileName.split(".");
      let newName = "";
      if (parts.length > 1) {
        const ext = parts.pop();
        newName = `${parts.join(".")}_copy.${ext}`;
      } else {
        newName = `${fileName}_copy`;
      }
      const newPath = `${parentDir}/${newName}`;
      const content = await readTextFileIpc(filePath);
      await writeTextFileIpc(newPath, content);
      await get().loadFolderEntries(parentDir);
      await get().openFile(newPath, newName);
      set({ statusMessage: `Duplicated to ${newName}` });
    } catch (err) {
      set({ statusMessage: `Failed to duplicate file: ${String(err)}` });
    }
  },

  revealInFileManager: async (targetPath: string) => {
    try {
      await revealInFileManagerIpc(targetPath);
    } catch (err) {
      set({ statusMessage: `Failed to open in file manager: ${String(err)}` });
    }
  },

  initFromPath: async (targetPath?: string) => {
    if (!targetPath || targetPath.trim().length === 0) return;
    await get().openTarget(targetPath.trim());
  },

  openTarget: async (targetPath: string) => {
    try {
      const normalized = normalizePath(targetPath);
      const info = await getPathInfoIpc(normalized);

      if (!info.exists) {
        set({ statusMessage: `Error: Path '${targetPath}' does not exist` });
        return;
      }

      if (info.is_dir) {
        const existing = get().projects.find(
          (p) => normalizePath(p.path).toLowerCase() === normalized.toLowerCase()
        );

        if (existing) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === existing.id ? { ...p, isExpanded: true } : p
            ),
            statusMessage: `Project '${existing.name}' is already open`,
          }));
          await get().loadFolderEntries(existing.path);
          return;
        }

        await get().addProjectFolder(info.path);
      } else {
        const normFile = normalizePath(info.path);
        const parentProject = get().projects.find((p) => {
          const normProj = normalizePath(p.path).toLowerCase();
          return normFile.toLowerCase().startsWith(normProj + "/");
        });

        await get().openFile(info.path, info.name, parentProject?.id);
      }
    } catch (err) {
      console.error("Failed to open target in CodeShark:", err);
      set({ statusMessage: `Failed to open: ${String(err)}` });
    }
  },

  addProjectFolder: async (dirPath: string) => {
    const norm = normalizePath(dirPath);
    const existing = get().projects.find(
      (p) => normalizePath(p.path).toLowerCase() === norm.toLowerCase()
    );

    if (existing) {
      set({ statusMessage: `Project '${existing.name}' is already open` });
      return;
    }

    const parts = norm.split("/");
    const name = parts[parts.length - 1] || norm;
    const newProject: ProjectRoot = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      path: dirPath,
      isExpanded: true,
    };

    set((state) => ({
      projects: [...state.projects, newProject],
      expandedFolders: { ...state.expandedFolders, [norm]: true },
      statusMessage: `Added project '${name}' to workspace`,
    }));

    await get().loadFolderEntries(dirPath);
    await get().refreshGitStatus(newProject.id);
  },

  removeProject: (projectId: string) => {
    const project = get().projects.find((p) => p.id === projectId);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
      statusMessage: project ? `Removed '${project.name}' from workspace` : null,
    }));
  },

  loadFolderEntries: async (folderPath: string) => {
    const norm = normalizePath(folderPath);
    set((state) => ({
      loadingFolders: { ...state.loadingFolders, [norm]: true },
    }));

    try {
      const entries = await readDirEntriesIpc(folderPath);
      const mapped: FileTreeNode[] = entries.map((entry) => ({
        name: entry.name,
        path: entry.path,
        isDir: entry.is_dir,
        size: entry.size,
      }));

      set((state) => ({
        treeNodes: { ...state.treeNodes, [norm]: mapped },
        loadingFolders: { ...state.loadingFolders, [norm]: false },
      }));
    } catch (err) {
      console.error(`Failed to load directory ${folderPath}:`, err);
      set((state) => ({
        loadingFolders: { ...state.loadingFolders, [norm]: false },
        statusMessage: `Error loading folder: ${String(err)}`,
      }));
    }
  },

  toggleFolder: async (folderPath: string) => {
    const norm = normalizePath(folderPath);
    const isExpanded = !!get().expandedFolders[norm];
    const newExpanded = !isExpanded;

    set((state) => ({
      expandedFolders: { ...state.expandedFolders, [norm]: newExpanded },
    }));

    if (newExpanded && !get().treeNodes[norm]) {
      await get().loadFolderEntries(folderPath);
    }
  },

  openFile: async (filePath: string, name?: string, projectId?: string) => {
    const norm = normalizePath(filePath);
    const existing = get().openTabs.find((t) => normalizePath(t.path) === norm);

    if (existing) {
      set({ activeFilePath: existing.path });
      return;
    }

    // Prevent duplicate concurrent opens for the same file
    if (inFlightOpeningFiles.has(norm)) {
      return;
    }
    inFlightOpeningFiles.add(norm);

    try {
      const fileName = name || norm.split("/").pop() || "untitled";
      const content = await readTextFileIpc(filePath);
      const language = detectLanguageByFilename(fileName);

      let gitHeadContent: string | undefined;
      const targetProjectId =
        projectId ||
        get().projects.find((p) => {
          const normProj = normalizePath(p.path).toLowerCase();
          return norm.toLowerCase().startsWith(normProj + "/");
        })?.id;

      if (targetProjectId) {
        const project = get().projects.find((p) => p.id === targetProjectId);
        if (project) {
          const head = await getFileGitHeadContentIpc(project.path, filePath);
          if (head !== null) {
            gitHeadContent = head;
          }
        }
      }

      const newTab: OpenFileTab = {
        id: `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        path: filePath,
        name: fileName,
        content,
        originalContent: content,
        gitHeadContent,
        isDirty: false,
        language,
        projectId: targetProjectId,
      };

      set((state) => {
        // Double-check deduplication: if tab was opened while reading content
        const alreadyOpen = state.openTabs.some((t) => normalizePath(t.path) === norm);
        if (alreadyOpen) {
          return { activeFilePath: filePath, statusMessage: `Opened ${fileName}` };
        }
        return {
          openTabs: [...state.openTabs, newTab],
          activeFilePath: filePath,
          statusMessage: `Opened ${fileName}`,
        };
      });
    } catch (err) {
      console.error(`Failed to read file ${filePath}:`, err);
      set({ statusMessage: `Failed to open file: ${String(err)}` });
    } finally {
      inFlightOpeningFiles.delete(norm);
    }
  },

  closeTab: (tabIdOrPath: string) => {
    const norm = normalizePath(tabIdOrPath);
    const currentTabs = get().openTabs;
    const tabIndex = currentTabs.findIndex(
      (t) => t.id === tabIdOrPath || normalizePath(t.path) === norm
    );
    if (tabIndex === -1) return;

    // Remove only the single target tab by index to prevent closing all duplicates if any exist
    const remaining = currentTabs.filter((_, idx) => idx !== tabIndex);
    const closedTab = currentTabs[tabIndex];
    let nextActive = get().activeFilePath;

    if (
      get().activeFilePath &&
      (normalizePath(get().activeFilePath!) === normalizePath(closedTab.path) ||
        get().activeFilePath === closedTab.id)
    ) {
      if (remaining.length > 0) {
        const nextIndex = Math.min(tabIndex, remaining.length - 1);
        nextActive = remaining[nextIndex].path;
      } else {
        nextActive = null;
      }
    }

    set({
      openTabs: remaining,
      activeFilePath: nextActive,
    });
  },

  closeOtherTabs: (tabIdOrPath: string) => {
    const norm = normalizePath(tabIdOrPath);
    const target = get().openTabs.find(
      (t) => t.id === tabIdOrPath || normalizePath(t.path) === norm
    );
    if (!target) return;
    set({
      openTabs: [target],
      activeFilePath: target.path,
    });
  },

  closeTabsToTheRight: (tabIdOrPath: string) => {
    const norm = normalizePath(tabIdOrPath);
    const currentTabs = get().openTabs;
    const tabIndex = currentTabs.findIndex(
      (t) => t.id === tabIdOrPath || normalizePath(t.path) === norm
    );
    if (tabIndex === -1) return;
    const remaining = currentTabs.slice(0, tabIndex + 1);
    let nextActive = get().activeFilePath;
    if (nextActive && !remaining.some((t) => normalizePath(t.path) === normalizePath(nextActive!))) {
      nextActive = remaining[remaining.length - 1].path;
    }
    set({
      openTabs: remaining,
      activeFilePath: nextActive,
    });
  },

  closeAllTabs: () => {
    set({
      openTabs: [],
      activeFilePath: null,
    });
  },

  saveAllFiles: async () => {
    const dirtyTabs = get().openTabs.filter((t) => t.isDirty);
    for (const tab of dirtyTabs) {
      await get().saveFile(tab.path);
    }
  },

  quietLinting: getInitialQuietLinting(),
  toggleQuietLinting: () => {
    const next = !get().quietLinting;
    try {
      localStorage.setItem(STORAGE_QUIET_LINTING, String(next));
    } catch {
      // ignore
    }
    set({
      quietLinting: next,
      statusMessage: next ? "Linting: Clean (All squigglies disabled)" : "Linting: Active",
    });
    setTimeout(() => {
      set({ statusMessage: null });
    }, 3000);
  },

  updateFileContent: (filePath: string, content: string) => {
    const norm = normalizePath(filePath);
    set((state) => ({
      openTabs: state.openTabs.map((tab) => {
        if (normalizePath(tab.path) === norm) {
          return {
            ...tab,
            content,
            isDirty: content !== tab.originalContent,
          };
        }
        return tab;
      }),
    }));
  },

  saveFile: async (filePath?: string) => {
    const targetPath = filePath || get().activeFilePath;
    if (!targetPath) return;

    const norm = normalizePath(targetPath);
    const tab = get().openTabs.find((t) => normalizePath(t.path) === norm);
    if (!tab) return;

    set({ isSaving: true });
    try {
      await writeTextFileIpc(tab.path, tab.content);
      set((state) => ({
        isSaving: false,
        openTabs: state.openTabs.map((t) =>
          normalizePath(t.path) === norm
            ? { ...t, originalContent: t.content, isDirty: false }
            : t
        ),
        statusMessage: `Saved ${tab.name}`,
      }));

      get().refreshGitStatus();

      setTimeout(() => {
        if (get().statusMessage === `Saved ${tab.name}`) {
          set({ statusMessage: null });
        }
      }, 3000);
    } catch (err) {
      console.error("Failed to save file:", err);
      set({
        isSaving: false,
        statusMessage: `Error saving: ${String(err)}`,
      });
    }
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  setSidebarWidth: (width: number) => {
    const clamped = Math.max(200, Math.min(650, width));
    set({ sidebarWidth: clamped });
  },

  refreshGitStatus: async (targetProjectId?: string) => {
    const projectsToRefresh = targetProjectId
      ? get().projects.filter((p) => p.id === targetProjectId)
      : get().projects;

    for (const project of projectsToRefresh) {
      try {
        const statusMap = await getRepoGitStatusIpc(project.path);
        set((state) => ({
          projectGitStatus: {
            ...state.projectGitStatus,
            [project.id]: statusMap,
          },
        }));
      } catch (err) {
        console.warn(`Failed to refresh git status for project ${project.name}:`, err);
      }
    }
  },

  setCursorPos: (line: number, col: number) => {
    set({ cursorPos: { line, col } });
  },

  setStatusMessage: (msg: string | null) => {
    set({ statusMessage: msg });
  },
}));
