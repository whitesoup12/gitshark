import React, { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useCodeSharkStore } from "../store/useCodeSharkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { CodeSharkHeader } from "./CodeSharkHeader";
import { CodeSharkSidebar } from "./CodeSharkSidebar";
import { CodeSharkTabs } from "./CodeSharkTabs";
import { CodeSharkEditor } from "./CodeSharkEditor";
import { CodeSharkStatusBar } from "./CodeSharkStatusBar";
import { CodeSharkQuickOpen } from "./CodeSharkQuickOpen";
import { isTauriEnvironment } from "@/lib/ipc";

export const CodeSharkApp: React.FC = () => {
  const {
    sidebarOpen,
    initFromPath,
    openTarget,
    saveFile,
    closeTab,
    toggleSidebar,
    activeFilePath,
    setSidebarTab,
    openInFileFind,
    openQuickOpen,
  } = useCodeSharkStore();

  // Initialize settings and theme on mount
  useEffect(() => {
    useSettingsStore.getState().initSettings();
  }, []);

  // Initialize from URL param initPath on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const initPath = params.get("initPath") || hashParams.get("initPath");
    if (initPath) {
      try {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("initPath");
        window.history.replaceState({}, document.title, cleanUrl.toString());
      } catch {
        // ignore in non-browser or mock environments
      }
      initFromPath(decodeURIComponent(initPath));
    }
  }, [initFromPath]);

  // Listen for open target events sent to this single running instance
  useEffect(() => {
    if (!isTauriEnvironment()) return;

    let isMounted = true;
    let unlistenFn: (() => void) | null = null;

    listen<{ path: string }>("codeshark:open-target", (event) => {
      if (event.payload?.path) {
        openTarget(event.payload.path);
      }
    }).then((fn) => {
      if (!isMounted) {
        fn();
      } else {
        unlistenFn = fn;
      }
    });

    return () => {
      isMounted = false;
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [openTarget]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveFile();
      } else if (isMod && e.key.toLowerCase() === "w") {
        e.preventDefault();
        if (activeFilePath) {
          closeTab(activeFilePath);
        }
      } else if (isMod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      } else if (isMod && e.shiftKey && e.key.toLowerCase() === "f") {
        // Global search in files: Ctrl+Shift+F
        e.preventDefault();
        if (!sidebarOpen) toggleSidebar();
        setSidebarTab("search");
      } else if (isMod && !e.shiftKey && e.key.toLowerCase() === "f") {
        // In-file Find: Ctrl+F
        e.preventDefault();
        openInFileFind(false);
      } else if (isMod && e.key.toLowerCase() === "h") {
        // In-file Find & Replace: Ctrl+H
        e.preventDefault();
        openInFileFind(true);
      } else if (isMod && !e.shiftKey && e.key.toLowerCase() === "p") {
        // Quick open file: Ctrl+P
        e.preventDefault();
        openQuickOpen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    saveFile,
    closeTab,
    toggleSidebar,
    activeFilePath,
    sidebarOpen,
    setSidebarTab,
    openInFileFind,
    openQuickOpen,
  ]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-shark-950 font-sans text-shark-100 select-none">
      {/* Header */}
      <CodeSharkHeader />

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {sidebarOpen && <CodeSharkSidebar />}

        <main className="flex-1 flex flex-col overflow-hidden bg-shark-950 relative">
          <CodeSharkTabs />
          <CodeSharkEditor />
        </main>
      </div>

      {/* Quick Open Modal */}
      <CodeSharkQuickOpen />

      {/* Status Bar */}
      <CodeSharkStatusBar />
    </div>
  );
};

export default CodeSharkApp;
