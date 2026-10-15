import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Tab } from "@/types";
import { HookStatusPanel } from "./HookStatusPanel";
import {
  writePtyInputIpc,
  resizePtyIpc,
  killPtyIpc,
  listenToTerminalData,
  listenToTerminalExit,
} from "@/lib/ipc";
import {
  X,
  RotateCcw,
  Square,
  Terminal as TerminalIcon,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface TerminalDrawerProps {
  tab: Tab;
  onClose: () => void;
}

export const TerminalDrawer: React.FC<TerminalDrawerProps> = ({ tab, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Terminal height resizing with persistence
  const [terminalHeight, setTerminalHeight] = useState<number>(() => {
    const saved = localStorage.getItem("gitshark_terminal_height");
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 120 && parsed <= 800) {
        return parsed;
      }
    }
    return 256;
  });
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);

  const handleTerminalResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingTerminal(true);
    const startY = e.clientY;
    const startHeight = terminalHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const maxHeight = Math.round(window.innerHeight * 0.85);
      const newHeight = Math.min(Math.max(startHeight + delta, 120), maxHeight);
      setTerminalHeight(newHeight);
      fitAddonRef.current?.fit();
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsResizingTerminal(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      const delta = startY - upEvent.clientY;
      const maxHeight = Math.round(window.innerHeight * 0.85);
      const finalHeight = Math.min(Math.max(startHeight + delta, 120), maxHeight);
      localStorage.setItem("gitshark_terminal_height", String(finalHeight));
      setTimeout(() => fitAddonRef.current?.fit(), 50);
    };

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleResetTerminalHeight = () => {
    setTerminalHeight(256);
    localStorage.setItem("gitshark_terminal_height", "256");
    setTimeout(() => fitAddonRef.current?.fit(), 50);
  };

  const repoId = tab.repoId;

  // Initialize xterm and addons
  useEffect(() => {
    if (!containerRef.current || !repoId) return;

    const term = new Terminal({
      theme: {
        background: "#090d16",
        foreground: "#e2e8f0",
        cursor: "#38bdf8",
        selectionBackground: "#0284c740",
        black: "#0f172a",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#facc15",
        blue: "#38bdf8",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#f8fafc",
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      fontSize: 12,
      lineHeight: 1.25,
      cursorBlink: true,
      convertEol: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    terminalInstanceRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln("\x1b[1;36m[GitShark PTY Bridge Initialized]\x1b[0m");
    term.writeln(`Scoped session: \x1b[90m${repoId}\x1b[0m`);
    term.writeln("Ready for hooks, network streaming, and Git CLI tasks.\r\n");

    // Handle interactive stdin from terminal
    const inputDisposable = term.onData((data) => {
      writePtyInputIpc(repoId, data).catch((err) => {
        console.warn("PTY input failed:", err);
      });
    });

    // Handle resizing
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (term.cols && term.rows) {
          resizePtyIpc(repoId, term.cols, term.rows).catch(() => {});
        }
      } catch {
        // ignore layout resize edge cases
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Subscribe to backend PTY streaming channel
    let unlistenData: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;

    listenToTerminalData(repoId, (chunk) => {
      term.write(chunk);
    }).then((unlisten) => {
      unlistenData = unlisten;
    });

    listenToTerminalExit(repoId, (payload) => {
      setIsRunning(false);
      term.writeln(
        `\r\n\x1b[90m[Process exited with code ${payload.exit_code ?? 0}]\x1b[0m\r\n`
      );
    }).then((unlisten) => {
      unlistenExit = unlisten;
    });

    return () => {
      inputDisposable.dispose();
      resizeObserver.disconnect();
      if (unlistenData) unlistenData();
      if (unlistenExit) unlistenExit();
      term.dispose();
      terminalInstanceRef.current = null;
      fitAddonRef.current = null;
    };
  }, [repoId]);

  const handleClear = () => {
    terminalInstanceRef.current?.clear();
  };

  const handleStop = async () => {
    if (!repoId) return;
    await killPtyIpc(repoId);
    setIsRunning(false);
  };

  return (
    <div
      style={{
        height: isExpanded ? "65%" : `${terminalHeight}px`,
      }}
      className={`flex flex-col bg-shark-950 border-t border-shark-800 z-10 relative flex-shrink-0 ${
        isResizingTerminal ? "" : "transition-[height] duration-200"
      }`}
    >
      {/* Draggable top resize handle for terminal */}
      <div
        onMouseDown={handleTerminalResizeMouseDown}
        onDoubleClick={handleResetTerminalHeight}
        className="absolute -top-1 left-0 w-full h-2.5 cursor-row-resize hover:bg-sky-500/30 active:bg-sky-500/50 transition-colors z-20 group"
        title="Drag to resize terminal height (Double-click to reset)"
      >
        <div className="h-[1px] w-full my-auto bg-transparent group-hover:bg-sky-400/80 transition-colors" />
      </div>

      {/* Terminal Drawer Header Toolbar */}
      <div className="flex items-center justify-between px-3 h-8 bg-shark-900 border-b border-shark-800 select-none">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-xs font-semibold text-slate-200">
            Terminal / Hooks Stream
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              isRunning ? "bg-emerald-400 animate-pulse" : "bg-slate-600"
            }`}
            title={isRunning ? "Command Running" : "Idle"}
          />
        </div>

        {/* Terminal Controls */}
        <div className="flex items-center gap-1.5">
          {isRunning && (
            <button
              onClick={handleStop}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-red-300 bg-red-950/60 border border-red-800/60 hover:bg-red-900/60 transition-colors"
              title="Terminate running process"
            >
              <Square className="w-2.5 h-2.5" />
              <span>Kill</span>
            </button>
          )}

          <div className="h-3 w-[1px] bg-shark-750 mx-1" />

          <button
            onClick={handleClear}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors"
            title="Clear Terminal"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors"
            title={isExpanded ? "Restore Height" : "Maximize Height"}
          >
            {isExpanded ? (
              <Minimize2 className="w-3 h-3" />
            ) : (
              <Maximize2 className="w-3 h-3" />
            )}
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-red-300 hover:bg-shark-800 transition-colors"
            title="Close Drawer (`)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Hook Status & Orchestration Banner */}
      <HookStatusPanel tab={tab} />

      {/* Terminal Viewport */}
      <div ref={containerRef} className="flex-1 w-full overflow-hidden bg-shark-950" />
    </div>
  );
};

