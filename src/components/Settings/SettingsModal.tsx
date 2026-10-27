import React, { useEffect, useState } from "react";
import {
  X,
  Bookmark,
  Settings,
  Terminal,
  Palette,
  Info,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  RefreshCw,
  Cpu,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Waves,
} from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useSharkStore } from "@/store/useSharkStore";
import { APP_VERSION } from "@/constants/version";
import { useUpdateStore } from "@/store/useUpdateStore";
import { openInBrowserIpc } from "@/lib/ipc";
import { GitSharkLogo } from "@/components/common/GitSharkLogo";
import type { SettingsTab } from "@/types";

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    activeTab,
    gitInfo,
    isLoadingGitInfo,
    customPathInput,
    isTestingPath,
    testResult,
    saveMessage,
    closeSettings,
    setActiveTab,
    setCustomPathInput,
    browseForGitExecutable,
    testPath,
    saveGitPath,
    resetToAutoDetected,
    loadGitInfo,
    diffRefreshDelayMs,
    setDiffRefreshDelayMs,
    devDirectory,
    setDevDirectory,
    browseForDevDirectory,
    pushTagsOption,
    setPushTagsOption,
  } = useSettingsStore();

  const {
    hasUpdate,
    latestVersion,
    releaseUrl,
    isChecking: isCheckingUpdates,
    lastChecked: lastCheckedUpdates,
    error: updateError,
    checkForUpdates,
  } = useUpdateStore();

  const {
    celebrationsEnabled,
    wisdomEnabled,
    setCelebrationsEnabled,
    setWisdomEnabled,
    triggerCelebration,
  } = useSharkStore();

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isSettingsOpen) {
      loadGitInfo();
    }
  }, [isSettingsOpen, loadGitInfo]);

  if (!isSettingsOpen) return null;

  const handleCopyPath = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "git", label: "Git Engine", icon: <Cpu className="w-4 h-4" /> },
    { id: "terminal", label: "Terminal & Shell", icon: <Terminal className="w-4 h-4" /> },
    { id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4" /> },
    { id: "about", label: "About GitShark", icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-3xl bg-shark-900 border border-shark-750 rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-shark-800 bg-shark-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Settings</h2>
              <p className="text-xs text-slate-400">Configure Git execution, terminal preferences, and environment</p>
            </div>
          </div>
          <button
            onClick={closeSettings}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-shark-800 rounded-lg transition-colors"
            title="Close Settings (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Left Sidebar Tabs + Right Content Area */}
        <div className="flex flex-1 min-h-[420px] overflow-hidden">
          {/* Settings Left Nav */}
          <nav className="w-52 border-r border-shark-800 bg-shark-950/40 p-3 space-y-1 select-none flex-shrink-0">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? "bg-sky-600/20 text-sky-300 border border-sky-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-shark-850"
                  }`}
                >
                  <span className={active ? "text-sky-400" : "text-slate-500"}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Settings Tab Content */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {/* TAB: Git Engine */}
            {activeTab === "git" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">
                    Git Executable Configuration
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    GitShark relies on a local Git CLI binary to execute worktrees, clones, and interactive PTY operations (commit, push, pull).
                  </p>
                </div>

                {/* Active Status Card */}
                <div className="p-4 rounded-lg bg-shark-950 border border-shark-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">Active Git Binary</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadGitInfo()}
                        disabled={isLoadingGitInfo}
                        className="p-1 text-slate-400 hover:text-sky-300 rounded hover:bg-shark-800 transition-colors"
                        title="Re-check Git binary status"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGitInfo ? "animate-spin text-sky-400" : ""}`} />
                      </button>
                      {gitInfo?.is_valid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-950/80 text-rose-300 border border-rose-800/50">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Not Found / Error
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-3 py-2 rounded bg-shark-900 border border-shark-800">
                    <span className="font-mono text-xs text-slate-200 truncate select-all" title={gitInfo?.current_path}>
                      {gitInfo?.current_path || "Scanning..."}
                    </span>
                    {gitInfo?.current_path && (
                      <button
                        onClick={() => handleCopyPath(gitInfo.current_path)}
                        className="ml-2 text-slate-500 hover:text-slate-300 p-1 rounded"
                        title="Copy full path"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  {gitInfo?.version && (
                    <div className="text-[11px] text-slate-400 font-mono">
                      {gitInfo.version}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>Source:</span>
                    {gitInfo?.is_custom ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-800/40 text-amber-300 font-medium">
                        Custom User Override
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-sky-950/70 border border-sky-800/40 text-sky-300 font-medium">
                        Auto-Detected (System / Scoop / AppData)
                      </span>
                    )}
                  </div>
                </div>

                {/* Custom Path Override Form */}
                <div className="space-y-3 pt-2 border-t border-shark-800">
                  <label className="block text-xs font-medium text-slate-300">
                    Custom <span className="font-mono">git.exe</span> Path Override
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Provide the path to a portable Git executable, corporate environment wrapper, or specific version you want GitShark to run.
                  </p>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customPathInput}
                      onChange={(e) => setCustomPathInput(e.target.value)}
                      placeholder={gitInfo?.auto_detected_path || "C:\\tools\\git\\bin\\git.exe"}
                      className="flex-1 px-3 py-2 bg-shark-950 border border-shark-750 focus:border-sky-500 focus:outline-none rounded-lg text-xs font-mono text-slate-200 placeholder:text-slate-600 shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={browseForGitExecutable}
                      className="flex items-center gap-1.5 px-3 py-2 bg-shark-800 hover:bg-shark-750 text-slate-200 border border-shark-700 hover:border-slate-500 rounded-lg text-xs font-medium transition-colors"
                      title="Browse filesystem for git.exe"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                      <span>Browse...</span>
                    </button>
                  </div>

                  {/* Test & Save Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => testPath(customPathInput)}
                        disabled={isTestingPath || !customPathInput.trim()}
                        className="px-3 py-1.5 bg-shark-850 hover:bg-shark-800 disabled:opacity-50 text-slate-300 border border-shark-750 rounded-lg text-xs font-medium transition-colors"
                      >
                        {isTestingPath ? "Verifying..." : "Test Path"}
                      </button>

                      <button
                        type="button"
                        onClick={() => saveGitPath(customPathInput)}
                        disabled={!customPathInput.trim()}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium rounded-lg text-xs shadow-md shadow-sky-900/30 transition-colors"
                      >
                        Save & Apply
                      </button>
                    </div>

                    {gitInfo?.is_custom && (
                      <button
                        type="button"
                        onClick={resetToAutoDetected}
                        className="text-xs text-slate-400 hover:text-amber-400 underline transition-colors"
                      >
                        Reset to Auto-Detect
                      </button>
                    )}
                  </div>

                  {/* Feedback Banners */}
                  {testResult && (
                    <div
                      className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                        testResult.valid
                          ? "bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 font-mono"
                          : "bg-rose-950/60 border border-rose-800/60 text-rose-300"
                      }`}
                    >
                      {testResult.valid ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div>{testResult.message}</div>
                    </div>
                  )}

                  {saveMessage && (
                    <div
                      className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                        saveMessage.success
                          ? "bg-sky-950/60 border border-sky-800/60 text-sky-300"
                          : "bg-rose-950/60 border border-rose-800/60 text-rose-300"
                      }`}
                    >
                      {saveMessage.success ? (
                        <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div>{saveMessage.message}</div>
                    </div>
                  )}
                </div>

                {/* Filesystem Watcher & Diff Refresh Delay */}
                <div className="space-y-3 pt-4 border-t border-shark-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-medium text-slate-200">
                        Diff & Working Changes Auto-Refresh Delay
                      </label>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Inactivity debounce window before auto-refreshing diffs and working tree status.
                      </p>
                    </div>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/40 font-semibold">
                      {diffRefreshDelayMs >= 1000 ? `${(diffRefreshDelayMs / 1000).toFixed(1)}s` : `${diffRefreshDelayMs}ms`}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2 pt-1">
                    {[
                      { label: "500ms", value: 500, desc: "Fast" },
                      { label: "1.0s", value: 1000, desc: "Responsive" },
                      { label: "1.5s", value: 1500, desc: "AI Default" },
                      { label: "2.5s", value: 2500, desc: "Heavy Bursts" },
                      { label: "4.0s", value: 4000, desc: "Extended" },
                    ].map((option) => {
                      const isSelected = diffRefreshDelayMs === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDiffRefreshDelayMs(option.value)}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all ${
                            isSelected
                              ? "bg-sky-600/20 border-sky-500/50 text-sky-300 ring-1 ring-sky-500/30"
                              : "bg-shark-950 border-shark-800 text-slate-400 hover:text-slate-200 hover:border-shark-700"
                          }`}
                        >
                          <span className="text-xs font-semibold font-mono">{option.label}</span>
                          <span className="text-[10px] text-slate-500 mt-0.5">{option.desc}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-2.5 rounded-lg bg-shark-950/60 border border-shark-800/70 text-[11px] text-slate-400 flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-300">AI Agent Optimization:</strong> When an AI coding assistant (e.g. Antigravity, Cursor, Claude Code) performs rapid multi-file writes, GitShark batches the changes into a single quiet-window refresh, preventing continuous UI flickering and diff unmounting.
                    </span>
                  </div>
                </div>

                {/* Development Directory */}
                <div className="space-y-3 pt-4 border-t border-shark-800">
                  <div>
                    <label className="block text-xs font-medium text-slate-200">
                      Development Directory
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Root folder containing your local repositories. All subfolders in this directory will be listed in the Open Repo dropdown.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={devDirectory || ""}
                      onChange={(e) => setDevDirectory(e.target.value || null)}
                      placeholder="e.g. D:\Development or /Users/name/Projects"
                      className="flex-1 px-3 py-2 bg-shark-950 border border-shark-750 focus:border-sky-500 focus:outline-none rounded-lg text-xs font-mono text-slate-200 placeholder:text-slate-600 shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={browseForDevDirectory}
                      className="flex items-center gap-1.5 px-3 py-2 bg-shark-800 hover:bg-shark-750 text-slate-200 border border-shark-700 hover:border-slate-500 rounded-lg text-xs font-medium transition-colors"
                      title="Browse filesystem for development directory"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                      <span>Browse...</span>
                    </button>
                    {devDirectory && (
                      <button
                        type="button"
                        onClick={() => setDevDirectory(null)}
                        className="px-2.5 py-2 text-slate-400 hover:text-rose-400 hover:bg-shark-800 border border-shark-750 rounded-lg text-xs transition-colors"
                        title="Clear development directory"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Push Tags Configuration */}
                <div className="space-y-3 pt-4 border-t border-shark-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-medium text-slate-200">
                        Push Tags Behavior
                      </label>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Automatically push Git tags when pushing commits or syncing your branch.
                      </p>
                    </div>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/40 font-semibold">
                      {pushTagsOption === "follow-tags" ? "--follow-tags" : pushTagsOption === "all" ? "--tags" : "disabled"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    {[
                      {
                        value: "follow-tags" as const,
                        label: "Follow Tags",
                        badge: "Recommended",
                        desc: "Pushes reachable annotated tags attached to commits (e.g. release tags)",
                        cmd: "git push --follow-tags",
                      },
                      {
                        value: "all" as const,
                        label: "Push All Tags",
                        badge: "Complete",
                        desc: "Pushes all local tags in your repository to remote origin",
                        cmd: "git push --tags",
                      },
                      {
                        value: "none" as const,
                        label: "Do Not Push Tags",
                        badge: "Default",
                        desc: "Only push commits; tags must be manually pushed individually",
                        cmd: "git push",
                      },
                    ].map((option) => {
                      const isSelected = pushTagsOption === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setPushTagsOption(option.value)}
                          className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all relative ${
                            isSelected
                              ? "bg-sky-600/15 border-sky-500/60 text-sky-200 ring-1 ring-sky-500/30"
                              : "bg-shark-950 border-shark-800 text-slate-400 hover:text-slate-200 hover:border-shark-700"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className="text-xs font-bold text-slate-100">{option.label}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                                isSelected
                                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                  : "bg-shark-800 text-slate-400 border border-shark-700"
                              }`}
                            >
                              {option.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug mb-2">
                            {option.desc}
                          </p>
                          <span className="mt-auto text-[10px] font-mono text-slate-500 bg-shark-900/90 px-1.5 py-0.5 rounded border border-shark-800">
                            {option.cmd}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-2.5 rounded-lg bg-shark-950/60 border border-shark-800/70 text-[11px] text-slate-400 flex items-start gap-2">
                    <Bookmark className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-300">GitHub Actions & Release Tip:</strong> When using <code className="text-sky-300 font-mono">--follow-tags</code> or <code className="text-sky-300 font-mono">--tags</code>, syncing or pushing your branch in GitShark will automatically push newly created release tags, immediately triggering your GitHub Actions release workflow without needing a separate manual push.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Terminal & Shell */}
            {activeTab === "terminal" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">Terminal & PTY Integration</h3>
                  <p className="text-xs text-slate-400">
                    Configure the embedded streaming terminal drawer and process execution environment.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-shark-950 border border-shark-800 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      PTY Subsystem Architecture
                    </label>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono bg-shark-900 p-2.5 rounded border border-shark-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>Windows ConPTY (Native Headless PseudoConsole)</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Process Window Mode
                    </label>
                    <div className="text-xs text-slate-400 bg-shark-900 p-2.5 rounded border border-shark-800">
                      <span>✓ CREATE_NO_WINDOW (Silent background execution enabled)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Appearance */}
            {activeTab === "appearance" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">Theme & Interface</h3>
                  <p className="text-xs text-slate-400">
                    Customize colors, layout density, and presentation.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-shark-950 border border-shark-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-slate-200">Shark Dark (Default)</div>
                      <div className="text-[11px] text-slate-500">Deep slate & obsidian optimized for long developer sessions</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] bg-sky-950 text-sky-400 border border-sky-800/40 font-medium">
                      Active
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">Ocean Vibes & Celebrations</h3>
                  <p className="text-xs text-slate-400">
                    Interactive nautical delights, swimming sharks, and Git wisdom.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-shark-950 border border-shark-800 space-y-4">
                  {/* Shark Celebrations Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-slate-200">Shark Celebrations</div>
                      <div className="text-[11px] text-slate-500">
                        Playful animated shark swim & glowing commit bubbles when commits and pushes succeed
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={celebrationsEnabled}
                        onChange={(e) => setCelebrationsEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-shark-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                    </label>
                  </div>

                  {/* Shark Wisdom Toggle */}
                  <div className="flex items-center justify-between pt-3 border-t border-shark-850">
                    <div>
                      <div className="text-xs font-medium text-slate-200">Shark Wisdom</div>
                      <div className="text-[11px] text-slate-500">
                        Click the top-left GitShark logo anytime to reveal witty Git insights and deep sea tips
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wisdomEnabled}
                        onChange={(e) => setWisdomEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-shark-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                    </label>
                  </div>

                  {/* Test Shark Swim & Chomp Buttons */}
                  <div className="pt-3 border-t border-shark-850 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">Preview shark animations:</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          triggerCelebration("chomp", "CHOMP! Snapping through stale code! 🦈");
                          closeSettings();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-medium transition-colors"
                      >
                        <span>Test Shark Chomp 🦷</span>
                      </button>
                      <button
                        onClick={() => {
                          triggerCelebration("swim", "Swimming through your changes! 🦈");
                          closeSettings();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/50 text-sky-300 text-xs font-medium transition-colors"
                      >
                        <Waves className="w-3.5 h-3.5" />
                        <span>Test Shark Swim 🦈</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: About */}
            {activeTab === "about" && (
              <div className="space-y-5">
                <div className="p-5 rounded-xl bg-gradient-to-br from-shark-950 via-shark-900 to-sky-950/30 border border-shark-800 flex items-start gap-4">
                  <div
                    onClick={() => {
                      triggerCelebration("frenzy", "🦈 MEGALODON FRENZY UNLOCKED! 🌊");
                      closeSettings();
                    }}
                    className="cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                    title="Click for a Megalodon surprise! 🦈"
                  >
                    <GitSharkLogo
                      size="xl"
                      withBackground={true}
                      withGlow={true}
                      className="rounded-xl shadow-lg shadow-sky-600/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-100">GitShark</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-sky-950 text-sky-400 border border-sky-800/50">
                        v{APP_VERSION}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Blazingly fast, modern Git desktop client built with Tauri v2, Rust (libgit2), React 19, and Tailwind CSS.
                    </p>
                  </div>
                </div>

                {/* Software Updates Card */}
                <div className="p-4 rounded-lg bg-shark-950 border border-shark-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-sky-400" />
                      <span className="font-medium text-slate-200">Software Updates</span>
                    </div>
                    <button
                      onClick={() => checkForUpdates(true)}
                      disabled={isCheckingUpdates}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-shark-850 hover:bg-shark-800 border border-shark-750 text-slate-300 hover:text-slate-100 transition-colors text-[11px] disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 text-sky-400 ${isCheckingUpdates ? "animate-spin" : ""}`} />
                      <span>{isCheckingUpdates ? "Checking..." : "Check for Updates"}</span>
                    </button>
                  </div>

                  {hasUpdate && latestVersion ? (
                    <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-600/40 flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-emerald-300 font-semibold text-xs">
                          <span>A new release of GitShark is available!</span>
                          <span className="font-mono text-[10px] bg-emerald-900/80 px-1.5 py-0.2 rounded border border-emerald-500/50 text-emerald-200 font-bold">
                            v{latestVersion}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          You are currently running v{APP_VERSION}. Click to review release notes and download.
                        </p>
                      </div>
                      <button
                        onClick={() => openInBrowserIpc(releaseUrl)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors shadow-sm flex-shrink-0"
                      >
                        <span>Download Update</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-2.5 rounded bg-shark-900/60 border border-shark-800/80">
                      <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>GitShark is up to date (v{APP_VERSION})</span>
                      </div>
                      {lastCheckedUpdates && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          Checked {new Date(lastCheckedUpdates).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  )}

                  {updateError && (
                    <div className="text-[11px] text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{updateError}</span>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-lg bg-shark-950 border border-shark-800 space-y-3 text-xs">
                  <div className="font-medium text-slate-300">Quick Commands</div>
                  <div className="space-y-2">
                    <div className="p-2 rounded bg-shark-900 border border-shark-800 font-mono text-[11px] text-slate-300 flex items-center justify-between">
                      <span>scoop install gitshark</span>
                      <button
                        onClick={() => handleCopyPath("scoop install gitshark")}
                        className="text-slate-500 hover:text-slate-300"
                        title="Copy Scoop command"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="p-2 rounded bg-shark-900 border border-shark-800 font-mono text-[11px] text-slate-300 flex items-center justify-between">
                      <span>winget install GitShark.GitShark</span>
                      <button
                        onClick={() => handleCopyPath("winget install GitShark.GitShark")}
                        className="text-slate-500 hover:text-slate-300"
                        title="Copy WinGet command"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-shark-800">
                  <span>Open Source under MIT License</span>
                  <a
                    href="https://github.com/whitesoup12/gitshark"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sky-400 hover:underline"
                  >
                    <span>GitHub Repository</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
