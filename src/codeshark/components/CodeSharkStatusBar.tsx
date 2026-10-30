import React, { useState, useEffect, useRef } from "react";
import { CheckCircle2, AlertCircle, GitBranch, Sparkles, Palette, Check } from "lucide-react";
import { useCodeSharkStore } from "../store/useCodeSharkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { THEMES } from "@/lib/theme";
import { normalizePath } from "../utils/language";

export const CodeSharkStatusBar: React.FC = () => {
  const {
    openTabs,
    activeFilePath,
    cursorPos,
    statusMessage,
    isSaving,
    projects,
    projectGitStatus,
    quietLinting,
    toggleQuietLinting,
  } = useCodeSharkStore();

  const { currentTheme, setTheme } = useSettingsStore();
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const themePickerRef = useRef<HTMLDivElement>(null);

  const activeTab = openTabs.find((t) => t.path === activeFilePath);
  const activeProject = projects.find((p) => p.id === activeTab?.projectId);
  const activeTheme = THEMES.find((t) => t.id === currentTheme) || THEMES[0];

  let activeGitStatus: string | undefined;
  if (activeProject && activeTab) {
    const gitMap = projectGitStatus[activeProject.id] || {};
    const normFile = normalizePath(activeTab.path);
    const normProj = normalizePath(activeProject.path);
    if (normFile.toLowerCase().startsWith(normProj.toLowerCase())) {
      const rel = normFile.slice(normProj.length).replace(/^[/\\]+/, "").toLowerCase();
      activeGitStatus = gitMap[rel];
    }
  }

  // Close theme picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setThemePickerOpen(false);
      }
    };
    if (themePickerOpen) {
      window.addEventListener("mousedown", handleClickOutside);
    }
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [themePickerOpen]);

  return (
    <footer className="relative flex items-center justify-between h-6 px-3 bg-shark-950 border-t border-shark-800 text-shark-300 text-[11px] select-none shrink-0 font-mono">
      {/* Left Status */}
      <div className="flex items-center space-x-3 truncate">
        {statusMessage ? (
          <span className="flex items-center space-x-1 text-cyan-200">
            {statusMessage.startsWith("Error") ? (
              <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0" />
            )}
            <span className="truncate">{statusMessage}</span>
          </span>
        ) : isSaving ? (
          <span className="text-cyan-300 animate-pulse">Saving...</span>
        ) : activeProject ? (
          <span className="flex items-center space-x-1 text-shark-300 truncate">
            <GitBranch className="w-3 h-3 text-cyan-400" />
            <span className="truncate">{activeProject.name}</span>
          </span>
        ) : (
          <span className="text-shark-400">Ready</span>
        )}

        {/* Active file Git status badge */}
        {activeGitStatus && (
          <span
            className={`px-1.5 py-0.2 rounded font-sans text-[10px] font-semibold border ${
              activeGitStatus === "modified"
                ? "bg-amber-950/60 text-amber-300 border-amber-800/60"
                : activeGitStatus === "untracked" || activeGitStatus === "new"
                ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
                : "bg-cyan-950/60 text-cyan-300 border-cyan-800/60"
            }`}
          >
            Git: {activeGitStatus}
          </span>
        )}
      </div>

      {/* Right Details */}
      <div className="flex items-center space-x-3 text-shark-400">
        {/* Theme Picker Button */}
        <div className="relative" ref={themePickerRef}>
          <button
            onClick={() => setThemePickerOpen(!themePickerOpen)}
            className="flex items-center space-x-1 px-1.5 py-0.2 rounded hover:bg-shark-800 text-shark-300 hover:text-white transition-colors text-[10px] font-sans border border-shark-800"
            title="Change Theme for GitShark & CodeShark"
          >
            <Palette className="w-3 h-3 text-cyan-400" />
            <span>{activeTheme.name}</span>
          </button>

          {/* Theme Picker Dropdown Popover */}
          {themePickerOpen && (
            <div className="absolute bottom-7 right-0 z-50 w-60 rounded-lg bg-shark-900 border border-shark-700 shadow-2xl p-1.5 text-xs text-shark-200 select-none animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1 text-[10px] uppercase font-bold text-shark-400 tracking-wider border-b border-shark-800 mb-1">
                Color Theme
              </div>
              <div className="space-y-0.5">
                {THEMES.map((theme) => {
                  const isActive = currentTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => {
                        setTheme(theme.id);
                        setThemePickerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded transition-colors text-left ${
                        isActive
                          ? "bg-cyan-950 text-cyan-200 font-medium"
                          : "hover:bg-shark-800 text-shark-300 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <div
                          style={{ backgroundColor: theme.primaryBg }}
                          className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0 shadow-inner"
                        />
                        <span className="truncate">{theme.name}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-shark-950 text-shark-400">
                          {theme.type}
                        </span>
                        {isActive && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Linting mode toggle */}
        <button
          onClick={toggleQuietLinting}
          className={`flex items-center space-x-1 px-1.5 py-0.2 rounded transition-colors text-[10px] font-sans ${
            quietLinting
              ? "bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-800/50"
              : "bg-cyan-900/60 text-cyan-200 hover:bg-cyan-800/60 border border-cyan-700/50"
          }`}
          title={
            quietLinting
              ? "Linting Clean: All squigglies and linting lines are removed. Click to enable linting."
              : "Linting Active: Diagnostics and squigglies enabled. Click to silence."
          }
        >
          <Sparkles className="w-2.5 h-2.5" />
          <span>{quietLinting ? "Lint: Clean" : "Lint: Active"}</span>
        </button>

        {activeTab && (
          <>
            <span>
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
            <span>Spaces: 2</span>
            <span>UTF-8</span>
            <span className="capitalize text-cyan-300 font-sans flex items-center space-x-1">
              <span>{activeTab.language}</span>
            </span>
          </>
        )}
      </div>
    </footer>
  );
};
