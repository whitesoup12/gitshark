import React, { useEffect, useState } from "react";
import { getSystemArchInfoIpc, openInBrowserIpc } from "@/lib/ipc";
import { SystemArchInfo } from "@/types";
import { AlertTriangle, Download, X } from "lucide-react";

export const ArchitectureMismatchBanner: React.FC = () => {
  const [archInfo, setArchInfo] = useState<SystemArchInfo | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    return localStorage.getItem("gitshark_dismissed_arch_mismatch") === "true";
  });

  useEffect(() => {
    if (dismissed) return;
    getSystemArchInfoIpc()
      .then((info) => {
        if (info.is_arch_mismatch) {
          setArchInfo(info);
        }
      })
      .catch((err) => {
        console.debug("Failed to query architecture info:", err);
      });
  }, [dismissed]);

  if (!archInfo || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("gitshark_dismissed_arch_mismatch", "true");
  };

  const handleDownload = () => {
    openInBrowserIpc("https://github.com/whitesoup12/gitshark/releases/latest");
  };

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-amber-950/90 border-b border-amber-800/80 text-amber-200 text-xs backdrop-blur-sm select-none z-30">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
        <span>
          <strong className="text-amber-300 font-semibold">Rosetta Architecture Mismatch:</strong> You are running the Intel (x64) build of GitShark on Apple Silicon. Git hooks and Node native bindings (such as Nx) may fail looking for darwin-x64.
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleDownload}
          className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium text-white bg-amber-600 hover:bg-amber-500 transition-colors shadow-sm"
          title="Download the native Apple Silicon (aarch64) build of GitShark"
        >
          <Download className="w-2.5 h-2.5" />
          <span>Get Apple Silicon Build</span>
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 rounded text-amber-400 hover:text-amber-200 hover:bg-amber-900/50 transition-colors"
          title="Dismiss banner"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
