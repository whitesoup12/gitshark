import React, { useState } from "react";
import { Tab, WorkingTreeStatus } from "@/types";
import { abortRepoOperationIpc, continueRepoOperationIpc } from "@/lib/ipc";
import { showConfirm } from "@/store/useDialogStore";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  Loader2,
  Check,
} from "lucide-react";

interface RepoOperationBannerProps {
  tab: Tab;
  status: WorkingTreeStatus;
  onRefresh: () => void;
}

export const RepoOperationBanner: React.FC<RepoOperationBannerProps> = ({
  tab,
  status,
  onRefresh,
}) => {
  const [isAborting, setIsAborting] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);

  const repoState = status.repo_state;
  if (!repoState || repoState === "clean") {
    // If repo is clean but there are still conflicted files listed
    if (!status.conflicted || status.conflicted.length === 0) {
      return null;
    }
  }

  const conflictedCount = status.conflicted?.length || 0;
  const isAllResolved = conflictedCount === 0;

  let stateTitle = "Merge in Progress";
  let opName = "Merge";
  if (repoState === "rebase") {
    stateTitle = "Rebase in Progress";
    opName = "Rebase";
  } else if (repoState === "cherry_pick") {
    stateTitle = "Cherry-Pick in Progress";
    opName = "Cherry-Pick";
  } else if (repoState === "revert") {
    stateTitle = "Revert in Progress";
    opName = "Revert";
  } else if (repoState === "bisect") {
    stateTitle = "Bisect in Progress";
    opName = "Bisect";
  }

  const handleAbort = async () => {
    if (!tab.repoId) return;

    const confirmed = await showConfirm({
      title: `Abort ${opName}?`,
      message: `Are you sure you want to abort the current ${opName.toLowerCase()}? All in-progress conflict resolutions and uncommitted merge changes will be rolled back.`,
      confirmText: `Abort ${opName}`,
      variant: "danger",
    });

    if (!confirmed) return;

    setIsAborting(true);
    try {
      await abortRepoOperationIpc(tab.repoId);
      onRefresh();
    } catch (err) {
      console.error(`Failed to abort ${opName}:`, err);
    } finally {
      setIsAborting(false);
    }
  };

  const handleContinue = async () => {
    if (!tab.repoId) return;

    setIsContinuing(true);
    try {
      await continueRepoOperationIpc(tab.repoId);
      onRefresh();
    } catch (err) {
      console.error(`Failed to continue ${opName}:`, err);
    } finally {
      setIsContinuing(false);
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-xs border-b select-none transition-all ${
        isAllResolved
          ? "bg-emerald-950/70 border-emerald-800 text-emerald-200"
          : "bg-rose-950/70 border-rose-800/80 text-rose-200"
      }`}
    >
      {/* Left: Operation Status & Label */}
      <div className="flex items-center gap-2.5">
        <div
          className={`p-1.5 rounded-full ${
            isAllResolved
              ? "bg-emerald-900/80 text-emerald-300"
              : "bg-rose-900/80 text-rose-300 animate-pulse"
          }`}
        >
          {isAllResolved ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 font-semibold text-slate-100">
            <span>{stateTitle}</span>
            {status.repo_state_label && (
              <span className="font-mono text-[11px] text-slate-300 font-normal px-1.5 py-0.2 bg-black/30 rounded border border-white/10">
                {status.repo_state_label}
              </span>
            )}
          </div>
          <div className="text-[11px] mt-0.5 text-slate-300/90">
            {isAllResolved ? (
              <span className="text-emerald-300 font-medium">
                All conflicts resolved! Ready to complete {opName.toLowerCase()}.
              </span>
            ) : (
              <span>
                <strong>{conflictedCount}</strong> conflicted {conflictedCount === 1 ? "file" : "files"} remaining to resolve.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Abort & Continue / Complete buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleAbort}
          disabled={isAborting || isContinuing}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-900/50 hover:bg-rose-800/80 text-rose-200 border border-rose-700/60 font-medium text-[11px] transition-colors"
          title={`Abort ${opName} and revert changes`}
        >
          {isAborting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <XCircle className="w-3 h-3" />
          )}
          <span>Abort {opName}</span>
        </button>

        <button
          onClick={handleContinue}
          disabled={!isAllResolved || isContinuing || isAborting}
          className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold text-[11px] shadow-sm transition-all ${
            isAllResolved
              ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              : "bg-shark-800 text-slate-500 border border-shark-700 cursor-not-allowed opacity-60"
          }`}
          title={
            isAllResolved
              ? `Complete the ${opName.toLowerCase()}`
              : `Resolve all ${conflictedCount} conflicts before continuing`
          }
        >
          {isContinuing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : isAllResolved ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3 h-3" />
          )}
          <span>{opName === "Merge" ? "Complete Merge" : `Continue ${opName}`}</span>
        </button>
      </div>
    </div>
  );
};
