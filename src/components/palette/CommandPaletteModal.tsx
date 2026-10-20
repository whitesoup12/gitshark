import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  Command,
  GitBranch,
  GitCommit,
  FileCode,
  FolderGit2,
  Folder,
  Terminal,
  ArrowDown,
  ArrowUp,
  Download,
  Globe,
  GitPullRequest,
  RotateCcw,
  Archive,
  Settings,
  Sparkles,
  AlertTriangle,
  X,
  Tag,
  History,
  FileText,
} from "lucide-react";
import { useCommandPaletteStore, PaletteCategory } from "@/store/useCommandPaletteStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useSharkStore } from "@/store/useSharkStore";
import { useBlameStore } from "@/store/useBlameStore";
import {
  getWorkingTreeStatusIpc,
  getCommitGraphIpc,
  getSavedOpenReposIpc,
  listDevFoldersIpc,
  type DevFolderItem,
} from "@/lib/ipc";
import { showPrompt } from "@/store/useDialogStore";
import { formatShortHash, formatRelativeTime } from "@/lib/utils";
import type { CommitNode, FileStatusItem } from "@/types";

export interface PaletteItem {
  id: string;
  category: "actions" | "branches" | "commits" | "files" | "repos";
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  icon: React.ReactNode;
  keywords?: string[];
  shortcut?: string;
  onSelect: () => void | Promise<void>;
}

export const CommandPaletteModal: React.FC = () => {
  const { isOpen, query, category, close, setQuery, setCategory } = useCommandPaletteStore();

  const {
    tabs,
    activeTabId,
    setActiveTab,
    openRepositoryTab,
    toggleTerminal,
    toggleSidebar,
    setActiveView,
    setCloneModalOpen,
    openRepoInBrowser,
    createPullRequestInBrowser,
    executePush,
    executePull,
    executeFetch,
    checkoutBranch,
    createBranch,
    createStash,
    applyStash,
    createTag,
    updateTab,
  } = useWorkspaceStore();

  const { openSettings } = useSettingsStore();
  const { openWisdom } = useSharkStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Dynamic state loaded on open
  const [workingStatus, setWorkingStatus] = useState<import("@/types").WorkingTreeStatus | null>(null);
  const [recentCommits, setRecentCommits] = useState<CommitNode[]>([]);
  const [recentRepos, setRecentRepos] = useState<string[]>([]);
  const [devRepos, setDevRepos] = useState<DevFolderItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load fresh contextual data when opened
  useEffect(() => {
    if (!isOpen) return;

    setSelectedIndex(0);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);

    // Load working tree files & commits for active tab
    if (activeTab?.repoId) {
      getWorkingTreeStatusIpc(activeTab.repoId)
        .then((st) => setWorkingStatus(st))
        .catch(() => setWorkingStatus(null));

      getCommitGraphIpc(activeTab.repoId)
        .then((g) => setRecentCommits(g.slice(0, 100)))
        .catch(() => setRecentCommits([]));
    }

    // Load saved repos history
    getSavedOpenReposIpc()
      .then((res) => setRecentRepos(res.open_paths || []))
      .catch(() => setRecentRepos([]));

    // Load dev directory repos if configured
    const devDir = useSettingsStore.getState().devDirectory;
    if (devDir) {
      listDevFoldersIpc(devDir)
        .then((f) => setDevRepos(f.filter((d) => d.is_git_repo)))
        .catch(() => setDevRepos([]));
    }
  }, [isOpen, activeTab?.repoId]);

  // Parse prefix query: e.g. "b ", "c ", "f ", "r ", "> "
  const { effectiveCategory, cleanQuery } = useMemo(() => {
    const trimmed = query.trimStart();
    if (trimmed.startsWith(">")) {
      return { effectiveCategory: "actions" as PaletteCategory, cleanQuery: trimmed.slice(1).trimStart() };
    }
    if (trimmed.startsWith("b ")) {
      return { effectiveCategory: "branches" as PaletteCategory, cleanQuery: trimmed.slice(2).trimStart() };
    }
    if (trimmed.startsWith("c ")) {
      return { effectiveCategory: "commits" as PaletteCategory, cleanQuery: trimmed.slice(2).trimStart() };
    }
    if (trimmed.startsWith("f ")) {
      return { effectiveCategory: "files" as PaletteCategory, cleanQuery: trimmed.slice(2).trimStart() };
    }
    if (trimmed.startsWith("r ")) {
      return { effectiveCategory: "repos" as PaletteCategory, cleanQuery: trimmed.slice(2).trimStart() };
    }
    return { effectiveCategory: category, cleanQuery: trimmed };
  }, [query, category]);

  // Build items list
  const allItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];

    // 1. Actions
    if (activeTab) {
      const tabId = activeTab.id;

      items.push({
        id: "action-view-changes",
        category: "actions",
        title: "Switch to Working Changes & Diff",
        subtitle: "Review modified files and stage commits",
        icon: <FileCode className="w-4 h-4 text-sky-400" />,
        keywords: ["diff", "changes", "staging", "status"],
        shortcut: "1",
        onSelect: () => {
          setActiveView(tabId, "status");
          close();
        },
      });

      items.push({
        id: "action-view-dag",
        category: "actions",
        title: "Switch to Commit Graph (DAG)",
        subtitle: "View topological history tree and branch lanes",
        icon: <GitCommit className="w-4 h-4 text-purple-400" />,
        keywords: ["graph", "dag", "tree", "history", "log"],
        shortcut: "2",
        onSelect: () => {
          setActiveView(tabId, "graph");
          close();
        },
      });

      items.push({
        id: "action-pull-rebase",
        category: "actions",
        title: "Pull with Rebase",
        subtitle: "Fetch from remote and rebase current branch",
        badge: "git pull --rebase",
        badgeColor: "bg-shark-800 text-slate-300 border-shark-700",
        icon: <ArrowDown className="w-4 h-4 text-emerald-400" />,
        keywords: ["pull", "rebase", "fetch", "upstream", "sync"],
        onSelect: async () => {
          close();
          await executePull(tabId, undefined, undefined, true);
        },
      });

      items.push({
        id: "action-pull-merge",
        category: "actions",
        title: "Pull with Merge",
        subtitle: "Fetch from remote and merge upstream",
        badge: "git pull",
        badgeColor: "bg-shark-800 text-slate-300 border-shark-700",
        icon: <ArrowDown className="w-4 h-4 text-emerald-400" />,
        keywords: ["pull", "merge", "fetch", "upstream"],
        onSelect: async () => {
          close();
          await executePull(tabId, undefined, undefined, false);
        },
      });

      items.push({
        id: "action-push",
        category: "actions",
        title: "Push to Upstream",
        subtitle: "Publish current branch commits to remote",
        badge: "git push",
        badgeColor: "bg-shark-800 text-slate-300 border-shark-700",
        icon: <ArrowUp className="w-4 h-4 text-sky-400" />,
        keywords: ["push", "publish", "sync", "remote"],
        onSelect: async () => {
          close();
          await executePush(tabId);
        },
      });

      items.push({
        id: "action-fetch-all",
        category: "actions",
        title: "Fetch All Remotes",
        subtitle: "Prune deleted remote references and fetch changes",
        badge: "git fetch --all --prune",
        badgeColor: "bg-shark-800 text-slate-300 border-shark-700",
        icon: <RotateCcw className="w-4 h-4 text-teal-400" />,
        keywords: ["fetch", "prune", "remotes"],
        onSelect: async () => {
          close();
          await executeFetch(tabId, undefined, true);
        },
      });

      items.push({
        id: "action-new-branch",
        category: "actions",
        title: "Create New Branch...",
        subtitle: "Create and checkout a new local branch from HEAD",
        icon: <GitBranch className="w-4 h-4 text-emerald-400" />,
        keywords: ["branch", "create", "new", "checkout -b"],
        onSelect: async () => {
          close();
          const name = await showPrompt({
            title: "Create New Branch",
            message: "Enter the name for the new branch:",
            placeholder: "feature/awesome-feature",
            confirmText: "Create & Checkout",
          });
          if (name && name.trim()) {
            await createBranch(tabId, name.trim(), undefined, true);
          }
        },
      });

      items.push({
        id: "action-create-stash",
        category: "actions",
        title: "Stash Changes...",
        subtitle: "Quick-stash uncommitted working changes",
        badge: "git stash",
        badgeColor: "bg-shark-800 text-slate-300 border-shark-700",
        icon: <Archive className="w-4 h-4 text-amber-400" />,
        keywords: ["stash", "wip", "save", "shelve"],
        onSelect: async () => {
          close();
          const msg = await showPrompt({
            title: "Stash Working Changes",
            message: "Enter an optional message for this stash:",
            placeholder: "WIP changes",
            confirmText: "Stash Changes",
          });
          if (msg !== null) {
            await createStash(tabId, msg.trim() || undefined, true);
          }
        },
      });

      items.push({
        id: "action-pop-stash",
        category: "actions",
        title: "Pop Latest Stash",
        subtitle: "Apply and drop stash@{0}",
        badge: "git stash pop",
        badgeColor: "bg-shark-800 text-slate-300 border-shark-700",
        icon: <Archive className="w-4 h-4 text-amber-400" />,
        keywords: ["stash", "pop", "apply", "unstash"],
        onSelect: async () => {
          close();
          await applyStash(tabId, 0);
        },
      });

      items.push({
        id: "action-create-tag",
        category: "actions",
        title: "Create Tag on HEAD...",
        subtitle: "Add an annotated or lightweight tag",
        icon: <Tag className="w-4 h-4 text-indigo-400" />,
        keywords: ["tag", "release", "version"],
        onSelect: async () => {
          close();
          const tagName = await showPrompt({
            title: "Create Tag",
            message: "Enter tag name (e.g. v1.0.0):",
            placeholder: "v1.0.0",
            confirmText: "Create Tag",
          });
          if (tagName && tagName.trim()) {
            await createTag(tabId, tagName.trim());
          }
        },
      });

      items.push({
        id: "action-toggle-terminal",
        category: "actions",
        title: activeTab.terminalOpen ? "Close PTY Terminal Drawer" : "Open PTY Terminal Drawer",
        subtitle: "Access integrated pseudo-terminal shell",
        icon: <Terminal className="w-4 h-4 text-sky-400" />,
        keywords: ["terminal", "pty", "shell", "console", "cmd", "bash"],
        shortcut: "`",
        onSelect: () => {
          toggleTerminal(tabId);
          close();
        },
      });

      items.push({
        id: "action-toggle-sidebar",
        category: "actions",
        title: activeTab.sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar",
        subtitle: "Toggle branch, tag, and stash navigation drawer",
        icon: <Folder className="w-4 h-4 text-slate-400" />,
        keywords: ["sidebar", "drawer", "toggle"],
        shortcut: "⌘B",
        onSelect: () => {
          toggleSidebar(tabId);
          close();
        },
      });

      items.push({
        id: "action-open-browser",
        category: "actions",
        title: "Open Repository in Browser",
        subtitle: "View remote on GitHub, GitLab, or Bitbucket",
        icon: <Globe className="w-4 h-4 text-sky-400" />,
        keywords: ["browser", "github", "gitlab", "remote", "web"],
        shortcut: "⌘⇧B",
        onSelect: () => {
          openRepoInBrowser(tabId);
          close();
        },
      });

      items.push({
        id: "action-new-pr",
        category: "actions",
        title: "Create Pull Request in Browser",
        subtitle: "Open PR comparison page on remote provider",
        icon: <GitPullRequest className="w-4 h-4 text-emerald-400" />,
        keywords: ["pr", "pull request", "mr", "merge request"],
        shortcut: "⌘⇧P",
        onSelect: () => {
          createPullRequestInBrowser(tabId);
          close();
        },
      });

      if (activeTab.selectedFilePath) {
        const selPath = activeTab.selectedFilePath;
        const baseName = selPath.split(/[/\\]/).pop() || selPath;

        items.push({
          id: "action-blame-selected",
          category: "actions",
          title: `Blame: ${baseName}`,
          subtitle: `Inspect line-by-line git blame authorship (${selPath})`,
          badge: "BLAME",
          badgeColor: "bg-sky-950 text-sky-300 border-sky-800",
          icon: <FileText className="w-4 h-4 text-sky-400" />,
          keywords: ["blame", "author", "line", selPath, baseName],
          onSelect: () => {
            close();
            useBlameStore
              .getState()
              .openBlame(activeTab.repoId!, selPath, tabId, "blame");
          },
        });

        items.push({
          id: "action-history-selected",
          category: "actions",
          title: `History: ${baseName}`,
          subtitle: `Inspect commit history and historical diffs (${selPath})`,
          badge: "HISTORY",
          badgeColor: "bg-indigo-950 text-indigo-300 border-indigo-800",
          icon: <History className="w-4 h-4 text-indigo-400" />,
          keywords: ["history", "log", "diff", "timeline", selPath, baseName],
          onSelect: () => {
            close();
            useBlameStore
              .getState()
              .openBlame(activeTab.repoId!, selPath, tabId, "history");
          },
        });
      }
    }

    // Global Actions (always available)
    items.push({
      id: "action-open-repo",
      category: "actions",
      title: "Open Local Repository...",
      subtitle: "Open directory picker to launch a repository tab",
      icon: <FolderGit2 className="w-4 h-4 text-sky-400" />,
      keywords: ["open", "repository", "folder", "directory"],
      shortcut: "⌘O",
      onSelect: () => {
        close();
        openRepositoryTab();
      },
    });

    items.push({
      id: "action-clone-repo",
      category: "actions",
      title: "Clone Remote Repository...",
      subtitle: "Clone via HTTPS or SSH with live streaming telemetry",
      icon: <Download className="w-4 h-4 text-teal-400" />,
      keywords: ["clone", "git clone", "download", "url"],
      onSelect: () => {
        close();
        setCloneModalOpen(true);
      },
    });

    items.push({
      id: "action-open-settings",
      category: "actions",
      title: "Open Settings...",
      subtitle: "Configure Git executable, theme, dev directory, and preferences",
      icon: <Settings className="w-4 h-4 text-slate-400" />,
      keywords: ["settings", "preferences", "config", "git binary"],
      shortcut: "⌘,",
      onSelect: () => {
        close();
        openSettings("git");
      },
    });

    items.push({
      id: "action-shark-companion",
      category: "actions",
      title: "Shark Companion & Stats...",
      subtitle: "Inspect Shark XP, levels, stats, and git wisdom",
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      keywords: ["shark", "wisdom", "companion", "xp", "stats", "rank"],
      onSelect: () => {
        close();
        openWisdom();
      },
    });

    // 2. Branches (from active tab)
    if (activeTab?.branches) {
      const tabId = activeTab.id;
      const currentBranch = activeTab.metadata?.current_branch;

      // Local branches
      activeTab.branches.local.forEach((b) => {
        const isHead = b.is_head || b.shorthand === currentBranch;
        let subtitle = "Local branch";
        if (b.upstream) {
          subtitle = `Tracks ${b.upstream}`;
          if (b.ahead || b.behind) {
            subtitle += ` (${b.ahead || 0}↑ ${b.behind || 0}↓)`;
          }
        }

        items.push({
          id: `branch-local-${b.name}`,
          category: "branches",
          title: b.shorthand,
          subtitle,
          badge: isHead ? "HEAD" : "LOCAL",
          badgeColor: isHead
            ? "bg-emerald-950 text-emerald-300 border-emerald-800"
            : "bg-sky-950 text-sky-300 border-sky-800",
          icon: <GitBranch className={`w-4 h-4 ${isHead ? "text-emerald-400" : "text-sky-400"}`} />,
          keywords: ["branch", b.name, b.shorthand, isHead ? "head current" : ""],
          onSelect: async () => {
            close();
            if (!isHead) {
              await checkoutBranch(tabId, b.name);
            }
          },
        });
      });

      // Remote branches
      activeTab.branches.remote.forEach((b) => {
        items.push({
          id: `branch-remote-${b.name}`,
          category: "branches",
          title: b.shorthand,
          subtitle: `Remote tracking branch (${b.name})`,
          badge: "REMOTE",
          badgeColor: "bg-purple-950 text-purple-300 border-purple-800",
          icon: <GitBranch className="w-4 h-4 text-purple-400" />,
          keywords: ["branch", "remote", b.name, b.shorthand],
          onSelect: async () => {
            close();
            await checkoutBranch(tabId, b.shorthand);
          },
        });
      });
    }

    // 3. Modified & Conflicted Files
    if (workingStatus && activeTab) {
      const tabId = activeTab.id;

      // Conflicted files
      (workingStatus.conflicted || []).forEach((f: FileStatusItem) => {
        items.push({
          id: `file-conflicted-${f.path}`,
          category: "files",
          title: f.path.split(/[/\\]/).pop() || f.path,
          subtitle: f.path,
          badge: "CONFLICT",
          badgeColor: "bg-rose-950 text-rose-300 border-rose-800 font-bold",
          icon: <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />,
          keywords: ["file", "conflict", f.path],
          onSelect: () => {
            setActiveView(tabId, "status");
            updateTab(tabId, { selectedFilePath: f.path });
            close();
          },
        });
      });

      // Staged files
      workingStatus.staged.forEach((f: FileStatusItem) => {
        items.push({
          id: `file-staged-${f.path}`,
          category: "files",
          title: f.path.split(/[/\\]/).pop() || f.path,
          subtitle: f.path,
          badge: "STAGED",
          badgeColor: "bg-emerald-950 text-emerald-300 border-emerald-800",
          icon: <FileCode className="w-4 h-4 text-emerald-400" />,
          keywords: ["file", "staged", f.path],
          onSelect: () => {
            setActiveView(tabId, "status");
            updateTab(tabId, { selectedFilePath: f.path });
            close();
          },
        });
      });

      // Unstaged files
      workingStatus.unstaged.forEach((f: FileStatusItem) => {
        items.push({
          id: `file-unstaged-${f.path}`,
          category: "files",
          title: f.path.split(/[/\\]/).pop() || f.path,
          subtitle: f.path,
          badge: "MODIFIED",
          badgeColor: "bg-amber-950 text-amber-300 border-amber-800",
          icon: <FileCode className="w-4 h-4 text-amber-400" />,
          keywords: ["file", "unstaged", "modified", f.path],
          onSelect: () => {
            setActiveView(tabId, "status");
            updateTab(tabId, { selectedFilePath: f.path });
            close();
          },
        });
      });

      // Untracked files
      workingStatus.untracked.forEach((f: FileStatusItem) => {
        items.push({
          id: `file-untracked-${f.path}`,
          category: "files",
          title: f.path.split(/[/\\]/).pop() || f.path,
          subtitle: f.path,
          badge: "UNTRACKED",
          badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
          icon: <FileCode className="w-4 h-4 text-slate-400" />,
          keywords: ["file", "untracked", "new", f.path],
          onSelect: () => {
            setActiveView(tabId, "status");
            updateTab(tabId, { selectedFilePath: f.path });
            close();
          },
        });
      });
    }

    // 4. Commits (recent 100 in active repo)
    if (activeTab && recentCommits.length > 0) {
      const tabId = activeTab.id;
      recentCommits.forEach((c) => {
        items.push({
          id: `commit-${c.hash}`,
          category: "commits",
          title: c.summary,
          subtitle: `${formatShortHash(c.hash)} by ${c.author} • ${formatRelativeTime(c.timestamp)}`,
          badge: formatShortHash(c.hash),
          badgeColor: "bg-shark-800 text-slate-400 border-shark-750 font-mono",
          icon: <GitCommit className="w-4 h-4 text-purple-400" />,
          keywords: ["commit", c.hash, formatShortHash(c.hash), c.summary, c.author],
          onSelect: () => {
            setActiveView(tabId, "graph");
            updateTab(tabId, { selectedCommitHash: c.hash });
            close();
          },
        });
      });
    }

    // 5. Open Repositories & Workspaces
    tabs.forEach((t) => {
      items.push({
        id: `tab-${t.id}`,
        category: "repos",
        title: t.title,
        subtitle: t.path || "Repository tab",
        badge: t.id === activeTabId ? "ACTIVE" : "OPEN",
        badgeColor: t.id === activeTabId
          ? "bg-sky-950 text-sky-300 border-sky-800"
          : "bg-shark-800 text-slate-400 border-shark-750",
        icon: <FolderGit2 className="w-4 h-4 text-sky-400" />,
        keywords: ["repo", "tab", t.title, t.path || ""],
        onSelect: () => {
          setActiveTab(t.id);
          close();
        },
      });
    });

    // Recent Repos from saved history
    recentRepos.forEach((rPath) => {
      const alreadyOpen = tabs.some((t) => t.path === rPath);
      if (!alreadyOpen) {
        const rName = rPath.split(/[/\\]/).pop() || rPath;
        items.push({
          id: `recent-repo-${rPath}`,
          category: "repos",
          title: rName,
          subtitle: rPath,
          badge: "RECENT",
          badgeColor: "bg-shark-800 text-slate-400 border-shark-750",
          icon: <FolderGit2 className="w-4 h-4 text-slate-400" />,
          keywords: ["recent", "repo", rName, rPath],
          onSelect: async () => {
            close();
            await openRepositoryTab(rPath);
          },
        });
      }
    });

    // Dev Directory repos
    devRepos.forEach((d) => {
      const alreadyOpen = tabs.some((t) => t.path === d.path);
      const alreadyRecent = recentRepos.includes(d.path);
      if (!alreadyOpen && !alreadyRecent) {
        items.push({
          id: `dev-repo-${d.path}`,
          category: "repos",
          title: d.name,
          subtitle: d.path,
          badge: "DEV",
          badgeColor: "bg-teal-950 text-teal-300 border-teal-800",
          icon: <FolderGit2 className="w-4 h-4 text-teal-400" />,
          keywords: ["dev", "repo", d.name, d.path],
          onSelect: async () => {
            close();
            await openRepositoryTab(d.path);
          },
        });
      }
    });

    return items;
  }, [
    activeTab,
    activeTabId,
    tabs,
    workingStatus,
    recentCommits,
    recentRepos,
    devRepos,
    setActiveView,
    toggleTerminal,
    toggleSidebar,
    executePush,
    executePull,
    executeFetch,
    checkoutBranch,
    createBranch,
    createStash,
    applyStash,
    createTag,
    openRepoInBrowser,
    createPullRequestInBrowser,
    openRepositoryTab,
    setCloneModalOpen,
    openSettings,
    openWisdom,
    updateTab,
    close,
  ]);

  // Filter items by category & search query
  const filteredItems = useMemo(() => {
    let list = allItems;
    if (effectiveCategory !== "all") {
      list = list.filter((item) => item.category === effectiveCategory);
    }

    if (!cleanQuery) return list;

    const tokens = cleanQuery.toLowerCase().split(/\s+/).filter(Boolean);

    return list
      .map((item) => {
        const titleLower = item.title.toLowerCase();
        const subtitleLower = (item.subtitle || "").toLowerCase();
        const keywordsLower = (item.keywords || []).join(" ").toLowerCase();
        const haystack = `${titleLower} ${subtitleLower} ${keywordsLower}`;

        let score = 0;
        let allTokensMatch = true;

        for (const token of tokens) {
          if (!haystack.includes(token)) {
            allTokensMatch = false;
            break;
          }
          if (titleLower.startsWith(token)) score += 50;
          else if (titleLower.includes(token)) score += 20;
          else score += 5;
        }

        if (!allTokensMatch) return null;
        return { item, score };
      })
      .filter((entry): entry is { item: PaletteItem; score: number } => entry !== null)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);
  }, [allItems, effectiveCategory, cleanQuery]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }

      if (filteredItems.length === 0) return;

      if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
      } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selectedItem = filteredItems[selectedIndex];
        if (selectedItem) {
          selectedItem.onSelect();
        }
      }
    },
    [filteredItems, selectedIndex, close]
  );

  // Auto-scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedElement = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [cleanQuery, effectiveCategory]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-100 select-none font-sans"
      onClick={() => close()}
    >
      {/* Modal Dialog Card */}
      <div
        className="w-full max-w-2xl bg-shark-950/95 border border-shark-750/90 rounded-xl shadow-2xl shadow-sky-950/20 overflow-hidden flex flex-col max-h-[70vh] border-t-sky-500/40 border-t-2"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header Bar */}
        <div className="flex items-center px-4 py-3 border-b border-shark-800 bg-shark-900/90 gap-3">
          <Search className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, branch, file, or commit... (or 'b ' for branches, 'c ' for commits)"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none font-mono tracking-tight"
            autoFocus
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded text-slate-400 hover:text-slate-200"
              title="Clear input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-shark-800 border border-shark-700 text-slate-400">
              ESC
            </span>
          )}
        </div>

        {/* Category Pills Navigation */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-shark-950 border-b border-shark-850/80 overflow-x-auto text-[11px] no-scrollbar">
          {(
            [
              { id: "all", label: "All" },
              { id: "actions", label: "> Actions" },
              { id: "branches", label: "b Branches" },
              { id: "files", label: "f Files" },
              { id: "commits", label: "c Commits" },
              { id: "repos", label: "r Repos" },
            ] as const
          ).map((cat) => {
            const isActive = effectiveCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setCategory(cat.id);
                  inputRef.current?.focus();
                }}
                className={`px-2.5 py-0.5 rounded-full font-medium transition-colors flex-shrink-0 ${
                  isActive
                    ? "bg-sky-600/30 text-sky-300 border border-sky-500/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-shark-850"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 space-y-0.5 min-h-[160px] max-h-[380px] text-xs divide-y divide-transparent"
        >
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500 text-xs gap-1.5">
              <Command className="w-6 h-6 text-slate-600" />
              <span>No commands or items matching "{cleanQuery}"</span>
              <span className="text-[11px] text-slate-600">
                Try searching for <strong>pull</strong>, <strong>branch</strong>, <strong>status</strong>, or prefix with <strong>b</strong> or <strong>c</strong>.
              </span>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={() => item.onSelect()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-sky-500/15 text-sky-100 border-l-2 border-sky-400 font-medium shadow-sm"
                      : "text-slate-300 hover:bg-shark-900 border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 mr-3 flex-1">
                    <span className="flex-shrink-0">{item.icon}</span>
                    <div className="flex flex-col min-w-0 truncate">
                      <span className="truncate font-semibold tracking-tight">
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span className="text-[10px] text-slate-500 truncate font-mono mt-0.2">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.badge && (
                      <span
                        className={`text-[9px] font-mono uppercase font-bold px-1.5 py-0.2 rounded border ${
                          item.badgeColor || "bg-shark-800 text-slate-400 border-shark-700"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {item.shortcut && (
                      <span className="text-[10px] font-mono text-slate-400 bg-shark-900 border border-shark-750 px-1.5 py-0.5 rounded shadow-sm">
                        {item.shortcut}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint Bar */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-shark-900/60 border-t border-shark-800 text-[10px] text-slate-400 font-mono select-none">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 rounded bg-shark-800 border border-shark-700 text-slate-300">↑↓</kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 rounded bg-shark-800 border border-shark-700 text-slate-300">↵</kbd>
              <span>select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 rounded bg-shark-800 border border-shark-700 text-slate-300">esc</kbd>
              <span>close</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-slate-500">
            <span>Prefix:</span>
            <span><strong>&gt;</strong> actions</span>
            <span><strong>b</strong> branches</span>
            <span><strong>f</strong> files</span>
            <span><strong>c</strong> commits</span>
            <span><strong>r</strong> repos</span>
          </div>
        </div>
      </div>
    </div>
  );
};
