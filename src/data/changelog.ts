export interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  summary: string;
  whatsNew: string[];
  fixes: string[];
  improvements?: string[];
}

export const CHANGELOG: ReleaseNote[] = [
  {
    version: "2.1.0",
    date: "2026-10-30",
    title: "Chum Bucket Fun, Branch Hierarchy, Two-Tier Header & CodeShark Polish",
    summary:
      "A feature-packed release introducing the interactive Chum Bucket minigame with Golden Megalodon jackpot, smart branch organization with nested remote forks and pagination, clean two-tier workspace header, dedicated repository actions, 'What's New' release notes modal, and critical CodeShark multi-hunk diff tab fixes.",
    whatsNew: [
      "Chum Bucket: Click the chum bucket next to the command bar to dump falling chum into the water and watch hungry sharks circle and feast!",
      "Golden Megalodon Jackpot: Very rare chance (<1%) when dumping chum to spawn a legendary Golden Megalodon and award +100 XP!",
      "Smart Branch Pagination: Local and remote branches now show the first 10 branches initially with an intuitive 'View All' / 'Show Less' toggle to prevent sidebar overflow.",
      "Remote Fork & Folder Dropdowns: Remote branches are now organized under dedicated dropdowns per fork (origin, upstream, etc.) with nested sub-folder hierarchy (e.g., feature/, bugfix/) and clean leaf branch labels.",
      "Two-Tier Header Redesign: Clean separation of the global titlebar and dedicated repository tab bar for a decluttered workspace.",
      "Header Repository Actions: Quick-access icon buttons for Pull, Push, and Fetch right on the active repository header.",
      "Sidebar Footer Actions: Web Browser and New PR buttons moved cleanly to a dedicated footer under Git Hooks.",
      "Bottom-Right Terminal Toggle: Relocated the terminal toggle button to the bottom-right corner of the workspace.",
      "What's New Modal: Automatic release notes popup on first launch of each new version, also accessible anytime from Settings → About.",
      "Pre-Push Changelog Enforcement: Automated git pre-push hook check ensuring release notes are documented before pushing new versions.",
    ],
    fixes: [
      "CodeShark Multi-Hunk Tabs: Fixed bug where opening CodeShark from a diff with multiple hunks opened duplicate tabs and closing one closed all.",
      "Cross-Window Theme Synchronization: Instant real-time theme sync between GitShark and CodeShark IDE windows.",
      "Tab Concurrency Lock: Added in-flight deduplication locks and index/ID-based closing to prevent duplicate open editors.",
      "Strict-Mode Mount Guard: Fixed URL parameter lifecycle and event listener leaks in CodeShark window initialization.",
    ],
    improvements: [
      "Chum Buoyancy & Physics: Dynamic lateral dispersion, staggered drop velocities, and prolonged sinking duration before sharks emerge.",
      "Sidebar Branch Navigation: Pinned current HEAD branch to the top of the local branch list and provided branch count badges on namespace folders.",
      "Workspace Shell Optimization: Smoother layout transitions and improved responsive spacing across sidebars.",
    ],
  },
  {
    version: "2.0.2",
    date: "2026-10-30",
    title: "Hotfix & Stability Updates",
    summary: "Critical hotfixes for window events, staging edge cases, and packaging manifests.",
    whatsNew: [
      "Initial CodeShark window communication protocols.",
      "Enhanced error reporting in terminal and hook runners.",
    ],
    fixes: [
      "Fixed git credential token resolution in detached HEAD states.",
      "Resolved window minimize state restoration.",
    ],
    improvements: [
      "Minor performance tweaks during repository scanning.",
    ],
  },
  {
    version: "2.0.1",
    date: "2026-10-29",
    title: "CodeShark Polish & Performance",
    summary:
      "Introduced live gutter git decorations, in-editor search and replace, and cross-platform performance enhancements.",
    whatsNew: [
      "In-Editor Search & Replace: Full-featured search and replace bar with match counters and regex options in CodeShark.",
      "Git Diff Gutter: Visual markers in CodeShark showing added, modified, and deleted lines compared to HEAD.",
      "Quick Open Palette: Press Ctrl+P / Cmd+P in CodeShark to instantly fuzzy-search and jump between files.",
    ],
    fixes: [
      "Monaco Theme Loading: Fixed initial editor theme flashes when opening files.",
      "Filesystem Watcher: Corrected path casing handling on Windows systems.",
    ],
    improvements: [
      "Memory usage optimizations during large diff rendering.",
      "Enhanced keyboard shortcut hints throughout CodeShark toolbars.",
    ],
  },
  {
    version: "2.0.0",
    date: "2026-10-28",
    title: "GitShark 2.0 & The CodeShark IDE",
    summary:
      "Massive milestone release introducing CodeShark — a dedicated built-in lightweight IDE — plus an overhauled commit graph visualizer and shark gamification.",
    whatsNew: [
      "CodeShark IDE: Built-in code editor powered by Monaco with custom dark themes (Shark Dark, Abyssal, Daylight Reef).",
      "Shark Companion System: Interactive desktop shark companion with mood states, XP leveling, and feeding stats.",
      "Branch Visualizer: Redesigned interactive commit tree with branch lane routing and merge commit tracking.",
      "Git Worktrees: First-class support for creating, switching, and managing linked git worktrees.",
    ],
    fixes: [
      "Conflict Resolver: Fixed diff3 conflict marker edge-cases with adjacent hunk boundaries.",
      "Credential Helper: Improved SSH and HTTPS personal access token memory caching.",
    ],
    improvements: [
      "Modernized UI with Tailwind CSS and custom shark color palette.",
      "Ultra-fast Rust backend powered by libgit2 and Tauri v2.",
    ],
  },
  {
    version: "1.9.0",
    date: "2026-10-22",
    title: "Pull Request Inspector & Blame Views",
    summary: "Added interactive line-by-line file blame and pull request comparison views.",
    whatsNew: [
      "Interactive File Blame: Inspect line-by-line git blame with commit avatar and author timestamp history.",
      "PR Comparison View: Compare branches side-by-side with full hunk staging capabilities.",
    ],
    fixes: [
      "Fixed git stash pop conflict handling when untracked files collided.",
    ],
    improvements: [
      "Unified and split diff view toggle persistence across sessions.",
    ],
  },
];
