import React from "react";
import { Tab, HookStage, HookStatus } from "@/types";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import {
  Play,
  RotateCcw,
  Square,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";

interface HookStatusPanelProps {
  tab: Tab;
}

const getStageLabel = (stage: HookStage, lastCommand?: string | null): string => {
  const prefix = lastCommand === "dry-run" ? "Dry Run: " : "";
  switch (stage) {
    case "pre-commit":
      return `${prefix}Pre-Commit`;
    case "commit-msg":
      return `${prefix}Commit-Msg`;
    case "post-commit":
      return `${prefix}Post-Commit`;
    case "pre-push":
      return `${prefix}Pre-Push`;
    case "committing":
      return "Git Commit";
    case "pushing":
      return "Git Push";
    default:
      return `${prefix}${stage}`;
  }
};

export const HookStatusPanel: React.FC<HookStatusPanelProps> = ({ tab }) => {
  const { cancelActiveProcess, retryLastHook, dismissHookStatus } =
    useWorkspaceStore();

  const hookState = tab.hookState;
  const hooksInfo = tab.hooksInfo;

  if (!hookState && (!hooksInfo || hooksInfo.active_hooks.length === 0)) {
    return null;
  }

  const stageLabel = hookState
    ? getStageLabel(hookState.stage, hookState.lastCommand)
    : "Hooks";
  const status: HookStatus = hookState?.status ?? "idle";
  const elapsed = hookState ? `${hookState.elapsedSeconds}s` : null;

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-shark-950/90 border-b border-shark-850 text-xs backdrop-blur-sm select-none">
      {/* Left: Active Hook Badges & Stopwatch */}
      <div className="flex items-center gap-2.5 overflow-x-auto py-0.5">
        {status === "running" && (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-sky-950/80 border border-sky-500/50 text-sky-300 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
            <span>
              [{stageLabel}: Running {elapsed}]
            </span>
          </div>
        )}

        {status === "passed" && (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>
              [{stageLabel}: Passed {elapsed}]
            </span>
          </div>
        )}

        {status === "failed" && (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-rose-950/80 border border-rose-500/50 text-rose-300">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            <span>
              [{stageLabel}: Failed {elapsed}
              {hookState?.exitCode !== undefined && ` (exit ${hookState.exitCode})`}]
            </span>
          </div>
        )}

        {status === "aborted" && (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-shark-800 border border-shark-700 text-slate-400">
            <XCircle className="w-3 h-3 text-slate-400" />
            <span>[{stageLabel}: Aborted]</span>
          </div>
        )}

        {/* Detected hooks pills */}
        {hooksInfo && hooksInfo.active_hooks.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 pl-1.5 border-l border-shark-800 text-[10px] text-slate-400">
            <ShieldCheck className="w-3 h-3 text-emerald-400/80" />
            <span className="font-medium text-slate-500">Configured:</span>
            {hooksInfo.active_hooks.map((h) => (
              <span
                key={h.name}
                className="px-1.5 py-0.2 rounded bg-shark-850 border border-shark-750 text-slate-300 font-mono"
                title={h.path}
              >
                {h.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right: Abort / Retry Controls */}
      <div className="flex items-center gap-2">
        {status === "running" && (
          <button
            onClick={() => cancelActiveProcess(tab.id)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-rose-300 bg-rose-950/70 border border-rose-800/80 hover:bg-rose-900/80 transition-colors"
            title="Send SIGINT/SIGTERM to cancel hook execution"
          >
            <Square className="w-2.5 h-2.5 fill-current" />
            <span>Abort</span>
          </button>
        )}

        {status === "failed" && (
          <>
            <button
              onClick={() => retryLastHook(tab.id)}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium text-white bg-sky-600 hover:bg-sky-500 transition-colors shadow-sm"
              title={hookState?.lastCommand === "dry-run" ? "Re-run hook dry run" : "Retry commit execution"}
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>{hookState?.lastCommand === "dry-run" ? "Re-run Hook" : "Retry Commit"}</span>
            </button>
            <button
              onClick={() => dismissHookStatus(tab.id)}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors"
              title="Dismiss failure status"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        )}

        {status === "aborted" && (
          <>
            <button
              onClick={() => retryLastHook(tab.id)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-200 bg-shark-800 hover:bg-shark-750 transition-colors"
            >
              <Play className="w-2.5 h-2.5" />
              <span>Restart</span>
            </button>
            <button
              onClick={() => dismissHookStatus(tab.id)}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        )}

        {status === "passed" && (
          <button
            onClick={() => dismissHookStatus(tab.id)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors"
            title="Dismiss status"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
