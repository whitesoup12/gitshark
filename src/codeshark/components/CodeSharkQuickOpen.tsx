import React, { useState, useEffect, useRef } from "react";
import { Search, FileCode, Folder, X, Loader2 } from "lucide-react";
import { useCodeSharkStore } from "../store/useCodeSharkStore";

export const CodeSharkQuickOpen: React.FC = () => {
  const {
    quickOpenOpen,
    quickOpenQuery,
    quickOpenResults,
    isQuickOpenSearching,
    closeQuickOpen,
    setQuickOpenQuery,
    openFile,
  } = useCodeSharkStore();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (quickOpenOpen) {
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [quickOpenOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [quickOpenResults]);

  if (!quickOpenOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeQuickOpen();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, quickOpenResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = quickOpenResults[selectedIndex];
      if (selected) {
        if (!selected.is_dir) {
          openFile(selected.path, selected.name);
        }
        closeQuickOpen();
      }
    }
  };

  return (
    <div
      onClick={closeQuickOpen}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-16 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-xl bg-shark-900 border border-shark-700 shadow-2xl overflow-hidden flex flex-col text-shark-200 select-none animate-in fade-in zoom-in-95 duration-100"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-3 py-2.5 border-b border-shark-800 space-x-2 bg-shark-950/60">
          <Search className="w-4 h-4 text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={quickOpenQuery}
            onChange={(e) => setQuickOpenQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type file name to open... (↑ ↓ to navigate, Enter to open, Esc to close)"
            className="flex-1 bg-transparent text-sm text-white placeholder-shark-500 focus:outline-none font-mono"
          />
          {isQuickOpenSearching && <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />}
          <button
            onClick={closeQuickOpen}
            className="p-1 rounded hover:bg-shark-800 text-shark-400 hover:text-shark-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-1 divide-y divide-shark-850">
          {quickOpenResults.length > 0 ? (
            quickOpenResults.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.path}
                  onClick={() => {
                    if (!item.is_dir) {
                      openFile(item.path, item.name);
                    }
                    closeQuickOpen();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded transition-colors ${
                    isSelected
                      ? "bg-cyan-950/70 text-cyan-200 border-l-2 border-cyan-400"
                      : "hover:bg-shark-800/50 text-shark-300"
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    {item.is_dir ? (
                      <Folder className="w-4 h-4 text-cyan-400 shrink-0" />
                    ) : (
                      <FileCode className="w-4 h-4 text-shark-400 shrink-0" />
                    )}
                    <span className="font-medium text-white truncate text-xs">{item.name}</span>
                    <span className="text-[11px] text-shark-500 truncate font-mono">
                      {item.relative_path}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] text-cyan-400 font-mono shrink-0 ml-2">
                      Enter to open
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs text-shark-500">
              {quickOpenQuery ? "No matching files found" : "Type to find files in workspace"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
