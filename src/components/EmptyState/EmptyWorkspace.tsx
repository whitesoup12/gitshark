import React from "react";
import { FolderGit2, Plus, Terminal, GitFork, Command, Download } from "lucide-react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { GitSharkLogo } from "@/components/common/GitSharkLogo";
import { APP_VERSION } from "@/constants/version";

import { useSharkStore } from "@/store/useSharkStore";

export const EmptyWorkspace: React.FC = () => {
  const { openRepositoryTab, createEmptyTab, setCloneModalOpen } = useWorkspaceStore();
  const { triggerCelebration } = useSharkStore();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-shark-950 select-none">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Brand Icon & Heading */}
        <div className="space-y-4">
          <div
            onClick={() => triggerCelebration("swim", "Welcome to the GitShark Seas! 🦈")}
            className="cursor-pointer inline-block group"
            title="Click to release the shark! 🦈"
          >
            <GitSharkLogo
              size="2xl"
              withBackground={true}
              withGlow={true}
              animated={true}
              className="mx-auto shadow-2xl shadow-sky-950/80 transition-transform group-hover:scale-105 duration-300"
            />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-sky-400 via-teal-300 to-sky-100 bg-clip-text text-transparent">
              Welcome to GitShark
            </h1>
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-sky-950/80 border border-sky-800/60 text-sky-400 font-semibold">
              v{APP_VERSION}
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            High-performance desktop Git client powered by Tauri v2, Rust & git2,
            featuring hardware-accelerated DAG visualization, PTY terminal hook orchestration, and worktree isolation.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => openRepositoryTab()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm"
          >
            <FolderGit2 className="w-4 h-4" />
            <span>Open Local Repo</span>
          </button>

          <button
            onClick={() => setCloneModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-shark-850 hover:bg-shark-800 text-sky-300 border border-sky-800/60 font-semibold text-xs transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Clone Repository</span>
          </button>

          <button
            onClick={() => createEmptyTab()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-shark-850 hover:bg-shark-800 text-slate-300 border border-shark-750 font-medium text-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Tab</span>
          </button>
        </div>


        {/* Feature Highlights / Architecture Badge */}
        <div className="grid grid-cols-3 gap-3 pt-6 border-t border-shark-850 text-left">
          <div className="p-3 rounded-lg bg-shark-900/40 border border-shark-800/60">
            <GitFork className="w-4 h-4 text-sky-400 mb-1.5" />
            <div className="text-xs font-semibold text-slate-200">git2-rs DAG</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Direct C-bindings for instantaneous commit graph & diffs
            </div>
          </div>

          <div className="p-3 rounded-lg bg-shark-900/40 border border-shark-800/60">
            <Terminal className="w-4 h-4 text-teal-400 mb-1.5" />
            <div className="text-xs font-semibold text-slate-200">PTY Streaming</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Live hook scripts (`pre-commit`) and network I/O in xterm
            </div>
          </div>

          <div className="p-3 rounded-lg bg-shark-900/40 border border-shark-800/60">
            <Command className="w-4 h-4 text-indigo-400 mb-1.5" />
            <div className="text-xs font-semibold text-slate-200">Multi-Repo Tabs</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Independent concurrent sessions isolated in Rust memory
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
