# 🦈 GitShark

**GitShark** is a high-performance, modern desktop Git client engineered with **Tauri v2**, **Rust (`git2-rs`)**, **React 19**, and **TypeScript**. Designed for speed, responsiveness, and developer clarity, GitShark brings hardware-accelerated DAG visualization, atomic hunk staging, integrated PTY terminal hook orchestration, and worktree isolation into a unified native desktop experience.

---

## ✨ Features

* **High-Performance Commit DAG**:
  * Real-time revwalk topological graph rendered on an HTML5 2D canvas with device-pixel-ratio scaling and viewport virtualization.
  * Cubic Bézier curves for merge routes and lane color assignment.
  * Rich reference pills (`HEAD -> branch`, tags, remote tracking).
  * Fast Commit Inspector with one-click hash copying, parent navigation, and committer metadata.

* **Working Directory Staging & File Diffs**:
  * Real-time file system monitoring via Rust `notify` emitting change events.
  * Side-by-side split workspace: Staging drawer on the left, interactive diff viewer on the right.
  * Selective staging: Stage all, unstage all, stage individual files, or stage/discard specific hunks.
  * Toggle between **Unified (Inline)** and **Side-by-Side (Split)** diff modes.
  * Syntax-aware line diffing with clear additions (`+`) and deletions (`-`) for modified, newly added, and deleted files.

* **Hook Orchestration & Native PTY Terminal**:
  * Automatic detection of active client hooks (`pre-commit`, `commit-msg`, `pre-push`).
  * Native pseudo-terminal (PTY) session spawning via `portable-pty` with byte-chunk streaming to `@xterm/xterm`.
  * Visual live hook badges (`Running`, `Passed`, `Failed`) with elapsed stopwatch counters.
  * Automatic drawer slide-open on commit/push and auto-collapse upon clean success; retains terminal open with abort controls on failure.

* **Worktree Management & Remote Operations**:
  * Native worktree lifecycle: add, inspect, and remove linked worktrees parsed from `git worktree list --porcelain`.
  * Open any linked worktree directly into an isolated workspace tab.
  * One-click **Pull** and **Push** controls in the navigation bar with real-time ahead/behind counters relative to upstream tracking branches.
  * Dedicated **Clone Wizard** modal with real-time object receiving/delta resolution percentage progress bars.

* **Multi-Repository Tab Management**:
  * Tab-isolated repository sessions with independent state, revision walkers, file watchers, and PTY processes.

---

## 🛠️ Tech Stack

* **Desktop Shell & Backend**:
  * [Tauri v2](https://v2.tauri.app/)
  * [Rust](https://www.rust-lang.org/)
  * [`git2-rs`](https://github.com/rust-lang/git2-rs) (libgit2 v0.20 with vendored C library)
  * [`portable-pty`](https://github.com/wez/wezterm/tree/main/pty)
  * [`notify`](https://github.com/notify-rs/notify) (cross-platform filesystem watcher)
* **Frontend**:
  * [React 19](https://react.dev/)
  * [TypeScript](https://www.typescriptlang.org/)
  * [Vite](https://vitejs.dev/)
  * [Tailwind CSS](https://tailwindcss.com/)
  * [Zustand](https://github.com/pmndrs/zustand)
  * [`@xterm/xterm`](https://xtermjs.org/)
  * [Lucide Icons](https://lucide.dev/)

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your development machine:

1. **Rust & Cargo**:
   * Install via [rustup.rs](https://rustup.rs/) (edition 2021+).
2. **Node.js**:
   * Node.js v18+ and `npm` (or `pnpm` / `yarn`).
3. **Git CLI**:
   * Installed and accessible in your system `PATH` (used for PTY commit/push/pull executions).
4. **C Compiler Build Tools** (for compiling vendored libgit2):
   * **Windows**: Visual Studio 2022 C++ Build Tools or MSVC toolchain.
   * **macOS**: Xcode Command Line Tools (`xcode-select --install`).
   * **Linux**: `build-essential`, `pkg-config`, `libssl-dev`.

### Installation

```bash
# Clone the repository
git clone https://github.com/whitesoup12/gitshark.git
cd gitshark

# Install frontend dependencies
npm install
```

### Development

Launch the desktop application in development mode with hot-reloading:

```bash
npm run dev
```

> **Note**: On Windows, the runner script automatically resolves your user `~/.cargo/bin` path for the Tauri CLI and Cargo toolchain.

### Building for Production

Compile both the frontend bundle and the native binary:

```bash
npm run build:desktop
```

Bundled installers and executables will be output to `src-tauri/target/release/bundle/`.

---

## 📜 License

This project is licensed under the terms of the [GNU General Public License v3.0 (GPL-3.0)](LICENSE).
