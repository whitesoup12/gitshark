import { create } from "zustand";
import type { ProjectRoot, FileTreeNode, OpenFileTab } from "@/types";
import {
  getPathInfoIpc,
  readDirEntriesIpc,
  readTextFileIpc,
  writeTextFileIpc,
  getRepoGitStatusIpc,
  getFileGitHeadContentIpc,
} from "@/lib/ipc";
import { detectLanguageByFilename, normalizePath } from "../utils/language";

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

  // Actions
  initFromPath: (targetPath?: string) => Promise<void>;
  openTarget: (targetPath: string) => Promise<void>;
  addProjectFolder: (dirPath: string) => Promise<void>;
  removeProject: (projectId: string) => void;
  loadFolderEntries: (folderPath: string) => Promise<void>;
  toggleFolder: (folderPath: string) => Promise<void>;
  openFile: (filePath: string, name?: string, projectId?: string) => Promise<void>;
  closeTab: (filePath: string) => void;
  closeOtherTabs: (filePath: string) => void;
  closeTabsToTheRight: (filePath: string) => void;
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
  sidebarWidth: 260,
  isSaving: false,
  statusMessage: null,
  cursorPos: { line: 1, col: 1 },

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
        // Check if project is already opened
        const existing = get().projects.find(
          (p) => normalizePath(p.path).toLowerCase() === normalized.toLowerCase()
        );

        if (existing) {
          // Project already open: make sure it's expanded and highlighted
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === existing.id ? { ...p, isExpanded: true } : p
            ),
            statusMessage: `Project '${existing.name}' is already open`,
          }));
          await get().loadFolderEntries(existing.path);
          return;
        }

        // Add new project root
        await get().addProjectFolder(info.path);
      } else {
        // Target is an individual file
        const normFile = normalizePath(info.path);
        // Find if it belongs to any existing project
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

    try {
      const fileName = name || norm.split("/").pop() || "untitled";
      const content = await readTextFileIpc(filePath);
      const language = detectLanguageByFilename(fileName);

      // Fetch committed Git HEAD content if file belongs to an active project
      let gitHeadContent: string | undefined;
      const targetProjectId = projectId || get().projects.find((p) => {
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

      set((state) => ({
        openTabs: [...state.openTabs, newTab],
        activeFilePath: filePath,
        statusMessage: `Opened ${fileName}`,
      }));
    } catch (err) {
      console.error(`Failed to read file ${filePath}:`, err);
      set({ statusMessage: `Failed to open file: ${String(err)}` });
    }
  },

  closeTab: (filePath: string) => {
    const norm = normalizePath(filePath);
    const currentTabs = get().openTabs;
    const tabIndex = currentTabs.findIndex((t) => normalizePath(t.path) === norm);
    if (tabIndex === -1) return;

    const remaining = currentTabs.filter((t) => normalizePath(t.path) !== norm);
    let nextActive = get().activeFilePath;

    if (get().activeFilePath && normalizePath(get().activeFilePath!) === norm) {
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

  closeOtherTabs: (filePath: string) => {
    const norm = normalizePath(filePath);
    const target = get().openTabs.find((t) => normalizePath(t.path) === norm);
    if (!target) return;
    set({
      openTabs: [target],
      activeFilePath: target.path,
    });
  },

  closeTabsToTheRight: (filePath: string) => {
    const norm = normalizePath(filePath);
    const currentTabs = get().openTabs;
    const tabIndex = currentTabs.findIndex((t) => normalizePath(t.path) === norm);
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

  quietLinting: true,
  toggleQuietLinting: () => {
    const next = !get().quietLinting;
    set({
      quietLinting: next,
      statusMessage: next ? "Linting: Syntax Only (No squigglies)" : "Linting: Relaxed (Ignoring missing imports)",
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

      // Refresh git status immediately on file save
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
    // Clamp between 180 and 600 px
    const clamped = Math.max(180, Math.min(600, width));
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
