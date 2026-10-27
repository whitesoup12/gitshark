import React, { useState, useRef, useEffect } from "react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { pickRepositoryDirectory, startCloneRepositoryIpc, cancelCloneIpc, listenToCloneProgress } from "@/lib/ipc";
import { CloneProgressPayload } from "@/types";
import {
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FolderOpen,
  GitBranch,
} from "lucide-react";
import { GitSharkLogo } from "@/components/common/GitSharkLogo";

export const CloneWizardModal: React.FC = () => {
  const { cloneModalOpen, setCloneModalOpen, openRepositoryTab } = useWorkspaceStore();
  const devDirectory = useSettingsStore((s) => s.devDirectory);

  const [url, setUrl] = useState("");
  const [destination, setDestination] = useState("");
  const [branch, setBranch] = useState("");
  const [depth, setDepth] = useState<number>(1);
  const [isShallow, setIsShallow] = useState(false);
  const [recurseSubmodules, setRecurseSubmodules] = useState(false);
  const [isDestinationManuallyEdited, setIsDestinationManuallyEdited] = useState(false);

  // Clone lifecycle
  const [isCloning, setIsCloning] = useState(false);
  const [progress, setProgress] = useState<CloneProgressPayload | null>(null);
  const [rawLogs, setRawLogs] = useState<string[]>([]);
  const activeCloneIdRef = useRef<string | null>(null);

  // Reset modal state whenever cloneModalOpen opens
  useEffect(() => {
    if (cloneModalOpen) {
      setUrl("");
      setBranch("");
      setDepth(1);
      setIsShallow(false);
      setRecurseSubmodules(false);
      setIsCloning(false);
      setProgress(null);
      setRawLogs([]);
      setIsDestinationManuallyEdited(false);
      const baseDir = devDirectory?.trim() || "";
      setDestination(baseDir);
    }
  }, [cloneModalOpen, devDirectory]);

  // Auto-suggest folder name from git URL when destination is defaulted to devDirectory
  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (!isDestinationManuallyEdited) {
      const baseDir = devDirectory?.trim() || "";
      if (baseDir) {
        const cleanedBase = baseDir.replace(/[/\\]+$/, "");
        const sep = cleanedBase.includes("\\") ? "\\" : "/";
        const cleaned = value.trim().replace(/\/+$/, "");
        const repoName = cleaned.split(/[/:]/).pop()?.replace(/\.git$/, "");
        if (repoName) {
          setDestination(`${cleanedBase}${sep}${repoName}`);
        } else {
          setDestination(cleanedBase);
        }
      } else {
        setDestination("");
      }
    }
  };

  const handleBrowseDestination = async () => {
    const selected = await pickRepositoryDirectory();
    if (selected) {
      setIsDestinationManuallyEdited(true);
      const cleaned = url.trim().replace(/\/+$/, "");
      const repoName = cleaned.split(/[/:]/).pop()?.replace(/\.git$/, "");
      if (repoName) {
        const separator = selected.includes("\\") ? "\\" : "/";
        setDestination(`${selected}${separator}${repoName}`);
      } else {
        setDestination(selected);
      }
    }
  };

  const handleStartClone = async () => {
    if (!url.trim() || !destination.trim() || isCloning) return;

    const cloneId = "clone-" + Math.random().toString(36).substring(2, 9);
    activeCloneIdRef.current = cloneId;

    setIsCloning(true);
    setProgress({
      clone_id: cloneId,
      stage: "Initializing",
      percentage: 0,
      raw_line: "Preparing clone operation...",
      is_complete: false,
    });
    setRawLogs(["$ git clone --progress ..."]);

    let unlisten: (() => void) | null = null;

    try {
      unlisten = await listenToCloneProgress(cloneId, async (payload) => {
        setProgress(payload);
        if (payload.raw_line) {
          setRawLogs((prev) => [...prev.slice(-30), payload.raw_line]);
        }

        if (payload.is_complete) {
          if (unlisten) unlisten();
          setIsCloning(false);

          if (!payload.error) {
            // Success! Register and switch to newly cloned repository
            setTimeout(async () => {
              setCloneModalOpen(false);
              await openRepositoryTab(destination);
            }, 800);
          }
        }
      });

      await startCloneRepositoryIpc(cloneId, {
        url: url.trim(),
        destination: destination.trim(),
        branch: branch.trim() || undefined,
        depth: isShallow ? (depth && depth > 0 ? depth : 1) : undefined,
        recurse_submodules: recurseSubmodules,
      });
    } catch (err: unknown) {
      if (unlisten) unlisten();
      setIsCloning(false);
      const errMsg = err instanceof Error ? err.message : String(err);
      setProgress({
        clone_id: cloneId,
        stage: "Failed",
        percentage: 0,
        raw_line: errMsg,
        is_complete: true,
        error: errMsg,
      });
    }
  };

  const handleCancel = async () => {
    if (activeCloneIdRef.current) {
      await cancelCloneIpc(activeCloneIdRef.current);
    }
    setIsCloning(false);
  };

  const handleClose = () => {
    if (isCloning) {
      handleCancel();
    }
    setCloneModalOpen(false);
    setProgress(null);
    setRawLogs([]);
    setUrl("");
    setBranch("");
    setIsDestinationManuallyEdited(false);
    setDestination(devDirectory?.trim() || "");
  };

  if (!cloneModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-shark-900 border border-shark-750 rounded-xl shadow-2xl overflow-hidden flex flex-col text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-shark-800 bg-shark-950/50">
          <div className="flex items-center gap-3">
            <GitSharkLogo size="lg" withBackground={true} className="rounded-lg shadow-sm" />
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                Clone Remote Repository
              </h2>
              <p className="text-[11px] text-slate-400">
                Clone over HTTPS or SSH with live streaming progress
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* URL Input */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">
              Repository URL <span className="text-sky-400">*</span>
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              disabled={isCloning}
              placeholder="https://github.com/owner/repository.git or git@github.com:owner/repo.git"
              className="w-full px-3 py-2 bg-shark-950 border border-shark-750 focus:border-sky-500 rounded-lg text-slate-100 placeholder-slate-500 font-mono text-xs outline-none transition-colors"
            />
          </div>

          {/* Destination Path */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">
              Destination Directory <span className="text-sky-400">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setIsDestinationManuallyEdited(true);
                }}
                disabled={isCloning}
                placeholder={devDirectory?.trim() ? devDirectory.trim() : "e.g. C:\\Projects\\repository"}
                className="flex-1 px-3 py-2 bg-shark-950 border border-shark-750 focus:border-sky-500 rounded-lg text-slate-100 placeholder-slate-500 font-mono text-xs outline-none transition-colors"
              />
              <button
                type="button"
                onClick={handleBrowseDestination}
                disabled={isCloning}
                className="flex items-center gap-1.5 px-3 py-2 bg-shark-800 hover:bg-shark-750 border border-shark-700 rounded-lg font-medium text-slate-300 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                <span>Browse</span>
              </button>
            </div>
          </div>

          {/* Optional Branch & Flags Grid */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-400 flex items-center gap-1">
                <GitBranch className="w-3 h-3 text-slate-400" />
                <span>Branch (Optional)</span>
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                disabled={isCloning}
                placeholder="default (HEAD)"
                className="w-full px-2.5 py-1.5 bg-shark-950 border border-shark-750 focus:border-sky-500 rounded-lg text-slate-200 placeholder-slate-500 font-mono text-xs outline-none"
              />
            </div>

            <div className="space-y-2 pt-5">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recurseSubmodules}
                  onChange={(e) => setRecurseSubmodules(e.target.checked)}
                  disabled={isCloning}
                  className="rounded bg-shark-950 border-shark-700 text-sky-500 focus:ring-0"
                />
                <span className="text-[11px]">Recurse Submodules</span>
              </label>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isShallow}
                    onChange={(e) => setIsShallow(e.target.checked)}
                    disabled={isCloning}
                    className="rounded bg-shark-950 border-shark-700 text-sky-500 focus:ring-0"
                  />
                  <span className="text-[11px]">Shallow depth</span>
                </label>
                {isShallow && (
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={depth}
                    onChange={(e) => setDepth(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={isCloning}
                    className="w-14 px-1.5 py-0.5 bg-shark-950 border border-shark-700 rounded text-center text-[11px] font-mono outline-none"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Live Progress Section */}
          {progress && (
            <div className="pt-3 border-t border-shark-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-medium">
                  {isCloning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                  ) : progress.error ? (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span className={progress.error ? "text-rose-300" : "text-sky-300"}>
                    {progress.stage}
                  </span>
                </div>
                <span className="font-mono text-slate-400 text-[11px]">
                  {Math.round(progress.percentage)}%
                </span>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full h-2 bg-shark-950 rounded-full overflow-hidden border border-shark-800">
                <div
                  className={`h-full transition-all duration-150 rounded-full ${
                    progress.error
                      ? "bg-rose-500"
                      : progress.is_complete
                      ? "bg-emerald-500"
                      : "bg-gradient-to-r from-sky-500 to-teal-400"
                  }`}
                  style={{ width: `${Math.max(5, progress.percentage)}%` }}
                />
              </div>

              {/* Raw Console Logs Snippet */}
              <div className="p-2 bg-shark-950 rounded border border-shark-800 font-mono text-[10px] text-slate-400 h-16 overflow-y-auto space-y-0.5">
                {rawLogs.map((log, i) => (
                  <div key={i} className="truncate">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-shark-800 bg-shark-950/40">
          <button
            type="button"
            onClick={handleClose}
            className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors text-xs"
          >
            {progress?.is_complete ? "Close" : "Cancel"}
          </button>

          {isCloning ? (
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-200 font-medium text-xs transition-colors"
            >
              <span>Stop Clone</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartClone}
              disabled={!url.trim() || !destination.trim()}
              className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 text-slate-950 font-bold text-xs shadow-md transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Clone Repository</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
