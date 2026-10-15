<p align="center">
  <img src="app-icon.svg" width="128" height="128" alt="GitShark Logo" />
</p>

<h1 align="center">GitShark</h1>

<p align="center">
  <strong>The blazing-fast, keyboard-driven native desktop Git client.</strong>
  <br />
  <em>Engineered with Tauri v2, Rust, and React 19 for developer velocity without the Electron bloat.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-v2-24C8DB?style=flat-square&logo=tauri&logoColor=white" alt="Tauri v2" />
  <img src="https://img.shields.io/badge/Rust-2021-dea584?style=flat-square&logo=rust&logoColor=white" alt="Rust" />
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/libgit2-v0.20-F05032?style=flat-square&logo=git&logoColor=white" alt="libgit2" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-emerald?style=flat-square" alt="License: GPL-3.0" /></a>
</p>

---

## 🦈 Why GitShark?

Most desktop Git GUIs are either sluggish Electron apps that swallow gigabytes of RAM or archaic wrappers that hide what Git is actually doing. 

**GitShark** is built differently. Powered by a native **Rust (`git2-rs`)** backend and **Tauri v2**, GitShark delivers sub-second startup times, near-zero idle resource usage, and direct native pseudo-terminal (PTY) integration. It gives developers the speed and transparency of the Git CLI paired with the clarity of a hardware-accelerated topological DAG and atomic hunk staging.

---

## ✨ Highlights

| Feature | Description |
| :--- | :--- |
| ⚡ **Featherweight Native Performance** | Compiled with Rust & Tauri v2 — launches in milliseconds with an ultra-lean memory footprint. |
| 🎨 **Hardware-Accelerated DAG** | 60+ FPS topological revwalk graph rendered on an HTML5 2D canvas with Bézier curves and lane routing. |
| 🔍 **Atomic Staging & Split Diff** | Independent staged vs. unstaged split view, syntax-aware line diffing, and hunk-level staging/discarding. |
| 🛡️ **Interactive Hook & PTY Terminal** | Spawns `pre-commit`, `commit-msg`, and `pre-push` hooks in a live PTY stream with stopwatch telemetry. |
| 🌿 **Worktree Lifecycle & Isolation** | Add, inspect, and open linked worktrees directly as isolated workspace tabs. |
| 🚀 **One-Click Upstream Sync** | Smart branch publishing with automated `--set-upstream` detection and ahead/behind commit indicators. |
| 📦 **Built-In Stash Drawer** | Quick-stash working changes, toggle untracked files, and apply, pop, or drop stashes from the sidebar. |

---

## 📸 Key Features

### 1. Working Changes & Interactive Diff Viewer
* **Split Staged / Unstaged Lists**: Side-by-side independent scrolling panes so you never lose context, even with hundreds of modified files.
* **Granular Control**: Stage all, unstage all, stage individual files, or discard unstaged modifications with one click.
* **Hunk-Level Staging**: Review unified or split diffs and stage or discard precise code hunks directly from the diff view.
* **Structured Commit Workflow**: Separate **Commit Summary** (single-line header) and **Commit Description** (detailed notes) inputs that automatically format standard Git commit conventions (`Ctrl+Enter` to commit).

### 2. High-Performance Commit DAG
* **Topological Visualization**: Revwalk commit tree with smooth Bézier curve lane allocation and device-pixel-ratio scaling.
* **Branch & Tag Pills**: Instant visual indicators for `HEAD`, local branches, remote tracking branches, and tags.
* **Commit Inspector**: Click any commit to view full author metadata, commit hash with one-click copying, parent tree navigation, and the full list of files changed with line additions and deletions.

### 3. PTY Terminal Bridge & Hook Telemetry
* **Real-Time Hook Streaming**: Automatically detects `.git/hooks` (`pre-commit`, `commit-msg`, `pre-push`) and spawns them through a native pseudo-terminal (`portable-pty`).
* **Live Stopwatch & Status**: Visual running spinners, elapsed execution timers, and pass/fail badges.
* **Non-Blocking Execution**: Auto-collapses on clean commits and keeps the terminal open with exit codes and abort controls if a hook rejects the commit.

### 4. Worktree Management & Clone Wizard
* **Worktree Isolation**: Parse `git worktree list --porcelain` and create or remove worktrees with ease. Open any linked worktree into an isolated workspace tab.
* **Streamed Clone Wizard**: Clone remote repositories (HTTPS/SSH) with live percentage progress parsing (`Receiving objects`, `Resolving deltas`) and automatic workspace tab registration.
* **Remote Sync**: View how many commits your branch is ahead or behind upstream, pull updates, or publish new branches with `--set-upstream origin <branch>` automatically configured.

---

## 🛠️ Architecture & Tech Stack

```
┌────────────────────────────────────────────────────────┐
│                   GitShark Frontend                    │
│      React 19  •  TypeScript  •  Tailwind CSS  •  Vite  │
│         Zustand State  •  @xterm/xterm Terminal        │
└───────────────────────────┬────────────────────────────┘
                            │ Tauri IPC (JSON / Events)
┌───────────────────────────┴────────────────────────────┐
│                    Tauri v2 Shell                      │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────┴────────────────────────────┐
│                   Rust Native Backend                  │
│  git2-rs (libgit2)  •  portable-pty  •  notify watcher │
└────────────────────────────────────────────────────────┘
```

* **Core Backend**: [Tauri v2](https://v2.tauri.app/), [Rust](https://www.rust-lang.org/), [`git2-rs`](https://github.com/rust-lang/git2-rs) (libgit2 v0.20), [`portable-pty`](https://github.com/wez/wezterm/tree/main/pty), [`notify`](https://github.com/notify-rs/notify).
* **UI & Client**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/), [Zustand](https://github.com/pmndrs/zustand), [`@xterm/xterm`](https://xtermjs.org/), [Lucide Icons](https://lucide.dev/).

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:

1. **Rust & Cargo**:
   * Install via [rustup.rs](https://rustup.rs/) (Rust edition 2021+).
2. **Node.js**:
   * Node.js v18+ and `npm` (or `pnpm` / `yarn`).
3. **Git CLI**:
   * Installed and accessible in your system `PATH`.
4. **C Compiler / Platform Build Tools** (for compiling vendored libgit2):
   * **Windows**: Visual Studio 2022 C++ Build Tools or MSVC toolchain.
   * **macOS**: Xcode Command Line Tools (`xcode-select --install`).
   * **Linux**: `build-essential`, `pkg-config`, `libssl-dev`.

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/whitesoup12/gitshark.git
cd gitshark

# 2. Install frontend dependencies
npm install
```

### Running in Development

Launch the desktop application with live hot-reloading:

```bash
npm run dev
```

### Building for Production

Compile both the frontend bundle and the optimized native release binary:

```bash
npm run build:desktop
```

Bundled installers and platform executables will be output directly to `src-tauri/target/release/bundle/`.

---

## ⌨️ Productivity Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Enter` / `Cmd + Enter` | Commit staged changes from Summary or Description fields |
| `Ctrl + W` / `Cmd + W` | Close the active repository tab |
| `Escape` | Dismiss modal dialogs & close quick-stash drawers |

---

## 📜 License

This project is licensed under the terms of the [GNU General Public License v3.0 (GPL-3.0)](LICENSE).
