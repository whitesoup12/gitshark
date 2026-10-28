import React, { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useCodeSharkStore } from "../store/useCodeSharkStore";
import { CodeSharkHeader } from "./CodeSharkHeader";
import { CodeSharkSidebar } from "./CodeSharkSidebar";
import { CodeSharkTabs } from "./CodeSharkTabs";
import { CodeSharkEditor } from "./CodeSharkEditor";
import { CodeSharkStatusBar } from "./CodeSharkStatusBar";
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
  } = useCodeSharkStore();

  // Initialize from URL param initPath on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const initPath = params.get("initPath") || hashParams.get("initPath");
    if (initPath) {
      initFromPath(decodeURIComponent(initPath));
    }
  }, [initFromPath]);

  // Listen for open target events sent to this single running instance
  useEffect(() => {
    if (!isTauriEnvironment()) return;

    let unlistenFn: (() => void) | null = null;
    listen<{ path: string }>("codeshark:open-target", (event) => {
      if (event.payload?.path) {
        openTarget(event.payload.path);
      }
    }).then((fn) => {
      unlistenFn = fn;
    });

    return () => {
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
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveFile, closeTab, toggleSidebar, activeFilePath]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-shark-950 font-sans text-shark-100 select-none">
      {/* Header */}
      <CodeSharkHeader />

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {sidebarOpen && <CodeSharkSidebar />}

        <main className="flex-1 flex flex-col overflow-hidden bg-shark-950">
          <CodeSharkTabs />
          <CodeSharkEditor />
        </main>
      </div>

      {/* Status Bar */}
      <CodeSharkStatusBar />
    </div>
  );
};

export default CodeSharkApp;
