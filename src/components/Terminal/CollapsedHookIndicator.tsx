import React from "react";
import { Tab } from "@/types";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Terminal as TerminalIcon,
  X,
} from "lucide-react";

interface CollapsedHookIndicatorProps {
  tab: Tab;
}

export const CollapsedHookIndicator: React.FC<CollapsedHookIndicatorProps> = ({
  tab,
}) => {
  const { toggleTerminal, dismissHookStatus } = useWorkspaceStore();

  const hookState = tab.hookState;
  if (!hookState || hookState.status === "idle" || tab.terminalOpen) {
    return null;
  }

  const { stage, status, elapsedSeconds, exitCode } = hookState;

  const stageName =
    stage === "pre-commit"
      ? "Pre-Commit"
      : stage === "commit-msg"
      ? "Commit-Msg"
      : stage === "pre-push"
      ? "Pre-Push"
      : "Commit";

  return (
    <div className="absolute bottom-3 right-4 z-20 flex items-center shadow-lg rounded-lg border overflow-hidden text-xs backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
      <button
        onClick={() => toggleTerminal(tab.id)}
        className={`flex items-center gap-2 px-3 py-1.5 transition-colors ${
          status === "running"
            ? "bg-sky-950/90 border-sky-600/60 text-sky-200 hover:bg-sky-900/90"
            : status === "passed"
            ? "bg-emerald-950/90 border-emerald-600/60 text-emerald-200 hover:bg-emerald-900/90"
            : status === "failed"
            ? "bg-rose-950/90 border-rose-600/60 text-rose-200 hover:bg-rose-900/90"
            : "bg-shark-900/90 border-shark-750 text-slate-300 hover:bg-shark-850/90"
        }`}
        title="Click to view terminal output (`)"
      >
        {status === "running" && (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
        )}
        {status === "passed" && (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        )}
        {status === "failed" && (
          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
        )}

        <span className="font-mono font-medium">
          [{stageName}:{" "}
          {status === "running"
            ? `Running ${elapsedSeconds}s`
            : status === "passed"
            ? `Passed ${elapsedSeconds}s`
            : status === "failed"
            ? `Failed (exit ${exitCode ?? 1})`
            : "Aborted"}
          ]
        </span>

        <TerminalIcon className="w-3 h-3 text-slate-400 ml-1" />
      </button>

      {status !== "running" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            dismissHookStatus(tab.id);
          }}
          className="px-1.5 py-2 bg-shark-900/90 hover:bg-shark-800 text-slate-400 hover:text-slate-200 border-l border-shark-750 transition-colors"
          title="Dismiss status"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
