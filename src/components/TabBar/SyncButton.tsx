import React, { useState } from "react";
import { Tab } from "@/types";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import {
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Cloud,
  Check,
} from "lucide-react";

interface SyncButtonProps {
  tab: Tab;
}

export const SyncButton: React.FC<SyncButtonProps> = ({ tab }) => {
  const { executePull, executePush, executeFetch, fetchRemoteSyncStatus, fetchBranches, refreshTabMetadata } = useWorkspaceStore();
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const sync = tab.remoteSync;
  const ahead = sync?.ahead ?? 0;
  const behind = sync?.behind ?? 0;
  const hasUpstream = sync?.has_upstream ?? false;

  const isHookPushing = tab.hookState?.status === "running" && tab.hookState?.lastCommand === "push";
  const isHookPulling = tab.hookState?.status === "running" && tab.hookState?.lastCommand === "pull";
  const isHookFetching = tab.hookState?.status === "running" && tab.hookState?.lastCommand === "fetch";
  const isHookRunning = tab.hookState?.status === "running";

  const effectivePushing = isPushing || isHookPushing;
  const effectivePulling = isPulling || isHookPulling;
  const effectiveFetching = isFetching || isHookFetching;
  const isBusy = effectivePulling || effectivePushing || effectiveFetching || isHookRunning;

  const handlePull = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!tab.repoId || isBusy) return;
    setIsPulling(true);
    try {
      await executePull(tab.id);
      await fetchRemoteSyncStatus(tab.id);
      await fetchBranches(tab.id);
      await refreshTabMetadata(tab.id);
    } catch (err) {
      console.warn("Pull failed:", err);
    } finally {
      setIsPulling(false);
    }
  };

  const handlePush = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!tab.repoId || isBusy) return;
    setIsPushing(true);
    try {
      await executePush(tab.id, undefined, undefined, false, !hasUpstream);
      await fetchRemoteSyncStatus(tab.id);
      await fetchBranches(tab.id);
      await refreshTabMetadata(tab.id);
    } catch (err) {
      console.warn("Push failed:", err);
    } finally {
      setIsPushing(false);
    }
  };

  const handleFetch = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!tab.repoId || isBusy) return;
    setIsFetching(true);
    try {
      await executeFetch(tab.id, undefined, true);
      await fetchRemoteSyncStatus(tab.id);
      await fetchBranches(tab.id);
      await refreshTabMetadata(tab.id);
    } catch (err) {
      console.warn("Fetch failed:", err);
    } finally {
      setIsFetching(false);
    }
  };

  if (!hasUpstream) {
    return (
      <button
        onClick={handlePush}
        disabled={isBusy}
        className="flex items-center gap-1.5 h-7 px-2.5 rounded text-xs transition-colors border border-sky-800/60 bg-sky-950/60 hover:bg-sky-900/60 text-sky-200 disabled:opacity-50"
        title="Publish current branch to remote (git push --set-upstream)"
      >
        <Cloud className={`w-3.5 h-3.5 text-sky-400 ${effectivePushing ? "animate-pulse" : ""}`} />
        <span className="text-[11px] font-medium">{effectivePushing ? "Publishing..." : "Publish Branch"}</span>
      </button>
    );
  }

  return (
    <div className="flex items-center rounded border border-shark-800 bg-shark-900/80 p-0.5 gap-1">
      {/* Explicit Pull Button */}
      <button
        onClick={handlePull}
        disabled={isBusy}
        className={`flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium transition-colors ${
          behind > 0
            ? "bg-indigo-950/70 text-indigo-300 border border-indigo-700/50 hover:bg-indigo-900/70"
            : "text-slate-300 hover:text-slate-100 hover:bg-shark-800"
        } disabled:opacity-50`}
        title={
          behind > 0
            ? `${behind} commits behind upstream. Click to pull (git pull).`
            : "Pull changes from remote (git pull)"
        }
      >
        <ArrowDown className={`w-3 h-3 text-indigo-400 ${effectivePulling ? "animate-bounce" : ""}`} />
        <span>Pull</span>
        {behind > 0 && (
          <span className="ml-0.5 px-1 py-0.2 rounded-full text-[10px] bg-indigo-500/30 text-indigo-200 font-mono">
            {behind}
          </span>
        )}
      </button>

      {/* Explicit Push Button */}
      <button
        onClick={handlePush}
        disabled={isBusy}
        className={`flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium transition-colors ${
          ahead > 0
            ? "bg-sky-950/70 text-sky-300 border border-sky-700/50 hover:bg-sky-900/70"
            : "text-slate-300 hover:text-slate-100 hover:bg-shark-800"
        } disabled:opacity-50`}
        title={
          ahead > 0
            ? `${ahead} commits ahead of upstream. Click to push (git push).`
            : "Push local commits to remote (git push)"
        }
      >
        <ArrowUp className={`w-3 h-3 text-sky-400 ${effectivePushing ? "animate-bounce" : ""}`} />
        <span>Push</span>
        {ahead > 0 && (
          <span className="ml-0.5 px-1 py-0.2 rounded-full text-[10px] bg-sky-500/30 text-sky-200 font-mono">
            {ahead}
          </span>
        )}
      </button>

      {/* Sync Status / Fetch Indicator */}
      <button
        onClick={handleFetch}
        disabled={isBusy}
        className="flex items-center gap-1 h-6 px-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors text-[11px] disabled:opacity-50"
        title="Refresh remote status (fetch)"
      >
        <RefreshCw className={`w-3 h-3 ${effectiveFetching || effectivePulling || effectivePushing ? "animate-spin text-sky-400" : ""}`} />
        {!ahead && !behind && !effectivePushing && !effectivePulling && !effectiveFetching && (
          <span className="text-emerald-400 text-[10px] font-medium hidden md:inline-flex items-center gap-0.5">
            <Check className="w-2.5 h-2.5" />
            <span>Synced</span>
          </span>
        )}
      </button>
    </div>
  );
};
