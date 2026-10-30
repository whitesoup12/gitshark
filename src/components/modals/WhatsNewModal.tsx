import React, { useEffect } from "react";
import {
  X,
  Sparkles,
  Wrench,
  Zap,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Tag,
  PartyPopper,
} from "lucide-react";
import { useChangelogStore } from "@/store/useChangelogStore";
import { GitSharkLogo } from "@/components/common/GitSharkLogo";
import { APP_VERSION } from "@/constants/version";
import { openInBrowserIpc } from "@/lib/ipc";

export const WhatsNewModal: React.FC = () => {
  const { isOpen, selectedVersion, releases, closeWhatsNew, setSelectedVersion } =
    useChangelogStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeWhatsNew();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeWhatsNew]);

  if (!isOpen) return null;

  const currentRelease =
    releases.find((r) => r.version === selectedVersion) || releases[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none"
      onClick={closeWhatsNew}
    >
      <div
        className="w-full max-w-3xl bg-shark-900 border border-shark-750 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-shark-950 via-shark-900 to-sky-950/40 border-b border-shark-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <GitSharkLogo
              size="md"
              withBackground={true}
              withGlow={true}
              className="rounded-xl shadow-md shadow-sky-500/20"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span>What's New in GitShark</span>
                  <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/60 shadow-sm">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Explore the latest features, improvements, and bug fixes.
              </p>
            </div>
          </div>

          <button
            onClick={closeWhatsNew}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-shark-800/80 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Layout: Version Selector Pills on top / tabs */}
        <div className="px-6 py-2.5 bg-shark-950/80 border-b border-shark-800 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Tag className="w-3 h-3" />
            <span>Releases:</span>
          </span>
          {releases.map((release) => {
            const isSelected = release.version === currentRelease.version;
            const isCurrentAppVersion = release.version === APP_VERSION;
            return (
              <button
                key={release.version}
                onClick={() => setSelectedVersion(release.version)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium transition-all ${
                  isSelected
                    ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20 scale-105"
                    : "bg-shark-850 hover:bg-shark-800 text-slate-400 hover:text-slate-200 border border-shark-750"
                }`}
              >
                <span>v{release.version}</span>
                {isCurrentAppVersion && (
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-sans font-bold uppercase tracking-tight ${
                      isSelected
                        ? "bg-slate-950/20 text-slate-950"
                        : "bg-sky-950 text-sky-400 border border-sky-800/50"
                    }`}
                  >
                    Current
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-slate-200 select-text">
          {/* Release Title Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-shark-950 via-shark-900 to-sky-950/20 border border-shark-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
                  <span className="font-bold">v{currentRelease.version}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>{currentRelease.date}</span>
                  </span>
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {currentRelease.title}
                </h3>
              </div>
              <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-cyan-400 shrink-0">
                <PartyPopper className="w-5 h-5" />
              </div>
            </div>
            {currentRelease.summary && (
              <p className="text-xs text-slate-300 mt-2.5 leading-relaxed font-sans">
                {currentRelease.summary}
              </p>
            )}
          </div>

          {/* Section: What's New */}
          {currentRelease.whatsNew && currentRelease.whatsNew.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-shark-800">
                <div className="p-1 rounded bg-sky-500/10 text-cyan-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 font-mono">
                  What's New
                </h4>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-950 text-cyan-400 font-mono border border-cyan-800/50">
                  {currentRelease.whatsNew.length}
                </span>
              </div>
              <div className="grid gap-2">
                {currentRelease.whatsNew.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-3 rounded-lg bg-shark-950/70 border border-shark-800/80 hover:border-cyan-500/30 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-200 leading-relaxed font-sans">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Bug Fixes */}
          {currentRelease.fixes && currentRelease.fixes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-shark-800">
                <div className="p-1 rounded bg-emerald-500/10 text-emerald-400">
                  <Wrench className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 font-mono">
                  Bug Fixes & Stability
                </h4>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-400 font-mono border border-emerald-800/50">
                  {currentRelease.fixes.length}
                </span>
              </div>
              <div className="grid gap-2">
                {currentRelease.fixes.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-3 rounded-lg bg-shark-950/70 border border-shark-800/80 hover:border-emerald-500/30 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-200 leading-relaxed font-sans">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Improvements */}
          {currentRelease.improvements && currentRelease.improvements.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-shark-800">
                <div className="p-1 rounded bg-purple-500/10 text-purple-400">
                  <Zap className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 font-mono">
                  Improvements & Polish
                </h4>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-950 text-purple-400 font-mono border border-purple-800/50">
                  {currentRelease.improvements.length}
                </span>
              </div>
              <div className="grid gap-2">
                {currentRelease.improvements.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-3 rounded-lg bg-shark-950/70 border border-shark-800/80 hover:border-purple-500/30 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-200 leading-relaxed font-sans">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-shark-950/90 border-t border-shark-800 flex items-center justify-between shrink-0 select-none">
          <button
            onClick={() =>
              openInBrowserIpc(
                `https://github.com/whitesoup12/gitshark/releases/tag/v${currentRelease.version}`
              )
            }
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors"
          >
            <span>View release on GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={closeWhatsNew}
            className="px-5 py-2 rounded-xl font-bold text-xs bg-gradient-to-r from-sky-500 to-cyan-400 hover:from-sky-400 hover:to-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 active:scale-95 transition-all"
          >
            Got it, let's swim! 🦈
          </button>
        </div>
      </div>
    </div>
  );
};
