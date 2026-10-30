import React, { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import {
  Scissors,
  Copy,
  Clipboard,
  CheckSquare,
  Search,
  Replace,
  Files,
  AlignLeft,
  FolderOpen,
  Save,
  Hash,
  Sparkles,
} from "lucide-react";
import { useCodeSharkStore } from "../store/useCodeSharkStore";
import { normalizePath } from "../utils/language";

interface CodeSharkEditorContextMenuProps {
  x: number;
  y: number;
  editor: monaco.editor.IStandaloneCodeEditor | null;
  activeFilePath: string;
  onClose: () => void;
}

export const CodeSharkEditorContextMenu: React.FC<CodeSharkEditorContextMenuProps> = ({
  x,
  y,
  editor,
  activeFilePath,
  onClose,
}) => {
  const {
    openInFileFind,
    setSidebarTab,
    setSearchQuery,
    executeGlobalSearch,
    saveFile,
    revealInFileManager,
    projects,
    setStatusMessage,
  } = useCodeSharkStore();

  const menuRef = useRef<HTMLDivElement>(null);

  // Position clamping
  const adjustedX = Math.min(x, window.innerWidth - 230);
  const adjustedY = Math.min(y, window.innerHeight - 380);

  // Close on outside click or Escape
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("mousedown", handleDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const getSelectedText = (): string => {
    if (!editor) return "";
    const selection = editor.getSelection();
    if (!selection || selection.isEmpty()) return "";
    const model = editor.getModel();
    return model ? model.getValueInRange(selection) : "";
  };

  const handleCut = async () => {
    if (!editor) return;
    const selected = getSelectedText();
    if (selected) {
      try {
        await navigator.clipboard.writeText(selected);
        editor.trigger("context-menu", "editor.action.clipboardCutAction", null);
      } catch {
        editor.trigger("context-menu", "editor.action.clipboardCutAction", null);
      }
    }
    onClose();
  };

  const handleCopy = async () => {
    if (!editor) return;
    const selected = getSelectedText();
    if (selected) {
      try {
        await navigator.clipboard.writeText(selected);
        setStatusMessage("Copied to clipboard");
      } catch {
        editor.trigger("context-menu", "editor.action.clipboardCopyAction", null);
      }
    }
    onClose();
  };

  const handlePaste = async () => {
    if (!editor) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const selection = editor.getSelection();
        if (selection) {
          editor.executeEdits("paste", [{ range: selection, text, forceMoveMarkers: true }]);
        }
      }
    } catch {
      editor.trigger("context-menu", "editor.action.clipboardPasteAction", null);
    }
    onClose();
  };

  const handleSelectAll = () => {
    if (!editor) return;
    editor.trigger("context-menu", "editor.action.selectAll", null);
    onClose();
  };

  const handleFind = () => {
    const selected = getSelectedText();
    openInFileFind(false, selected || undefined);
    onClose();
  };

  const handleReplace = () => {
    const selected = getSelectedText();
    openInFileFind(true, selected || undefined);
    onClose();
  };

  const handleFindInFiles = () => {
    const selected = getSelectedText();
    setSidebarTab("search");
    if (selected) {
      setSearchQuery(selected);
      setTimeout(executeGlobalSearch, 50);
    }
    onClose();
  };

  const handleFormat = () => {
    if (!editor) return;
    editor.trigger("context-menu", "editor.action.formatDocument", null);
    setStatusMessage("Formatted document");
    onClose();
  };

  const handleChangeAll = () => {
    if (!editor) return;
    editor.trigger("context-menu", "editor.action.changeAll", null);
    onClose();
  };

  const handleGotoLine = () => {
    if (!editor) return;
    editor.trigger("context-menu", "editor.action.gotoLine", null);
    onClose();
  };

  const handleCopyPath = async (relative: boolean) => {
    let text = activeFilePath;
    if (relative) {
      const project = projects.find((p) => {
        const normProj = normalizePath(p.path).toLowerCase();
        const normFile = normalizePath(activeFilePath).toLowerCase();
        return normFile.startsWith(normProj + "/");
      });
      if (project) {
        text = normalizePath(activeFilePath).slice(normalizePath(project.path).length + 1);
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatusMessage(`Copied ${relative ? "relative path" : "full path"}`);
    } catch {
      setStatusMessage("Failed to copy path");
    }
    onClose();
  };

  const handleReveal = async () => {
    await revealInFileManager(activeFilePath);
    onClose();
  };

  const handleSave = () => {
    saveFile(activeFilePath);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
      className="fixed z-50 w-56 rounded-lg bg-shark-900 border border-shark-700 shadow-2xl py-1 text-xs text-shark-200 select-none animate-in fade-in zoom-in-95 duration-100 divide-y divide-shark-800"
    >
      {/* Clipboard Group */}
      <div className="py-0.5">
        <button
          onClick={handleCut}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-cyan-950/70 hover:text-cyan-200 transition-colors text-left"
        >
          <div className="flex items-center space-x-2">
            <Scissors className="w-3.5 h-3.5 text-shark-400" />
            <span>Cut</span>
          </div>
          <span className="text-[10px] text-shark-500 font-mono">Ctrl+X</span>
        </button>
        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-cyan-950/70 hover:text-cyan-200 transition-colors text-left"
        >
          <div className="flex items-center space-x-2">
            <Copy className="w-3.5 h-3.5 text-shark-400" />
            <span>Copy</span>
          </div>
          <span className="text-[10px] text-shark-500 font-mono">Ctrl+C</span>
        </button>
        <button
          onClick={handlePaste}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-cyan-950/70 hover:text-cyan-200 transition-colors text-left"
        >
          <div className="flex items-center space-x-2">
            <Clipboard className="w-3.5 h-3.5 text-shark-400" />
            <span>Paste</span>
          </div>
          <span className="text-[10px] text-shark-500 font-mono">Ctrl+V</span>
        </button>
        <button
          onClick={handleSelectAll}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-cyan-950/70 hover:text-cyan-200 transition-colors text-left"
        >
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-3.5 h-3.5 text-shark-400" />
            <span>Select All</span>
          </div>
          <span className="text-[10px] text-shark-500 font-mono">Ctrl+A</span>
        </button>
      </div>

      {/* Find & Replace Group */}
      <div className="py-0.5">
        <button
          onClick={handleFind}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-cyan-950/70 hover:text-cyan-200 transition-colors text-left"
        >
          <div className="flex items-center space-x-2">
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span>Find...</span>
          </div>
          <span className="text-[10px] text-shark-500 font-mono">Ctrl+F</span>
        </button>
        <button
          onClick={handleReplace}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-cyan-950/70 hover:text-cyan-200 transition-colors text-left"
        >
          <div className="flex items-center space-x-2">
            <Replace className="w-3.5 h-3.5 text-cyan-400" />
            <span>Replace...</span>
          </div>
          <span className="text-[10px] text-shark-500 font-mono">Ctrl+H</span>
        </button>
        <button
          onClick={handleFindInFiles}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-cyan-950/70 hover:text-cyan-200 transition-colors text-left"
        >
          <div className="flex items-center space-x-2">
            <Files className="w-3.5 h-3.5 text-cyan-400" />
            <span>Find in Files...</span>
          </div>
          <span className="text-[10px] text-shark-500 font-mono">Ctrl+Shift+F</span>
        </button>
      </div>

      {/* Code Editing Tools */}
      <div className="py-0.5">
        <button
          onClick={handleFormat}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-cyan-950/70 hover:text-cyan-200 transition-colors text-left"
        >
          <div className="flex items-center space-x-2">
            <AlignLeft className="w-3.5 h-3.5 text-shark-400" />
            <span>Format Document</span>
          </div>
          <span className="text-[10px] text-shark-500 font-mono">Shift+Alt+F</span>
        </button>
        <button
          onClick={handleChangeAll}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-cyan-950/70 hover:text-cyan-200 transition-colors text-left"
        >
          <div className="flex items-center space-x-2">
            <Sparkles className="w-3.5 h-3.5 text-shark-400" />
            <span>Change All Occurrences</span>
          </div>
          <span className="text-[10px] text-shark-500 font-mono">Ctrl+F2</span>
        </button>
        <button
          onClick={handleGotoLine}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-cyan-950/70 hover:text-cyan-200 transition-colors text-left"
        >
          <div className="flex items-center space-x-2">
            <Hash className="w-3.5 h-3.5 text-shark-400" />
            <span>Go to Line...</span>
          </div>
          <span className="text-[10px] text-shark-500 font-mono">Ctrl+G</span>
        </button>
      </div>

      {/* File & Path Info */}
      <div className="py-0.5">
        <button
          onClick={() => handleCopyPath(false)}
          className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-shark-800 hover:text-shark-100 transition-colors text-left"
        >
          <Copy className="w-3.5 h-3.5 text-shark-400" />
          <span>Copy Path</span>
        </button>
        <button
          onClick={() => handleCopyPath(true)}
          className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-shark-800 hover:text-shark-100 transition-colors text-left"
        >
          <Copy className="w-3.5 h-3.5 text-shark-400" />
          <span>Copy Relative Path</span>
        </button>
        <button
          onClick={handleReveal}
          className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-shark-800 hover:text-shark-100 transition-colors text-left"
        >
          <FolderOpen className="w-3.5 h-3.5 text-shark-400" />
          <span>Reveal in File Explorer</span>
        </button>
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-cyan-950/70 hover:text-cyan-200 transition-colors text-left"
        >
          <div className="flex items-center space-x-2">
            <Save className="w-3.5 h-3.5 text-cyan-400" />
            <span>Save File</span>
          </div>
          <span className="text-[10px] text-shark-500 font-mono">Ctrl+S</span>
        </button>
      </div>
    </div>
  );
};
