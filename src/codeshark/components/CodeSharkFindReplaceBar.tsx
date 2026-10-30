import React, { useState, useEffect, useRef, useCallback } from "react";
import * as monaco from "monaco-editor";
import {
  ChevronUp,
  ChevronDown,
  X,
  ReplaceAll,
  CaseSensitive,
  WholeWord,
  Regex,
  ChevronRight,
} from "lucide-react";
import { useCodeSharkStore } from "../store/useCodeSharkStore";

interface CodeSharkFindReplaceBarProps {
  editor: monaco.editor.IStandaloneCodeEditor | null;
}

export const CodeSharkFindReplaceBar: React.FC<CodeSharkFindReplaceBarProps> = ({ editor }) => {
  const {
    inFileFindOpen,
    inFileReplaceOpen,
    inFileQuery,
    inFileReplaceWith,
    inFileMatchIndex,
    inFileTotalMatches,
    inFileCaseSensitive,
    inFileWholeWord,
    inFileIsRegex,
    closeInFileFind,
    setInFileQuery,
    setInFileReplaceWith,
    toggleInFileReplace,
    toggleInFileCaseSensitive,
    toggleInFileWholeWord,
    toggleInFileIsRegex,
    setInFileMatchStatus,
  } = useCodeSharkStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [matches, setMatches] = useState<monaco.editor.FindMatch[]>([]);
  const decorationsRef = useRef<string[]>([]);
  const findInputRef = useRef<HTMLInputElement>(null);

  // Focus find input when find opens
  useEffect(() => {
    if (inFileFindOpen) {
      setTimeout(() => {
        findInputRef.current?.focus();
        findInputRef.current?.select();
      }, 50);
    }
  }, [inFileFindOpen]);

  // Compute matches whenever query or flags change or editor content changes
  const updateMatches = useCallback(() => {
    if (!editor || !inFileQuery) {
      setMatches([]);
      setInFileMatchStatus(0, 0);
      decorationsRef.current = editor?.deltaDecorations(decorationsRef.current, []) || [];
      return;
    }

    const model = editor.getModel();
    if (!model) return;

    try {
      let searchPattern = inFileQuery;
      let effectiveRegex = inFileIsRegex;

      if (inFileWholeWord && !inFileIsRegex) {
        searchPattern = `\\b${searchPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`;
        effectiveRegex = true;
      }

      const found = model.findMatches(
        searchPattern,
        false,
        effectiveRegex,
        inFileCaseSensitive,
        null,
        true,
        2000
      );

      setMatches(found);
      const total = found.length;
      let nextIdx = 0;

      // Find if cursor is already near a match
      if (total > 0) {
        const cursor = editor.getPosition();
        if (cursor) {
          const matchAhead = found.findIndex((m) =>
            m.range.startLineNumber > cursor.lineNumber ||
            (m.range.startLineNumber === cursor.lineNumber && m.range.startColumn >= cursor.column)
          );
          nextIdx = matchAhead !== -1 ? matchAhead : 0;
        }
      }

      setCurrentIndex(nextIdx);
      setInFileMatchStatus(total > 0 ? nextIdx + 1 : 0, total);

      // Highlight matches in Monaco
      const newDecorations: monaco.editor.IModelDeltaDecoration[] = found.map((m, idx) => ({
        range: m.range,
        options: {
          className: idx === nextIdx ? "bg-amber-400/40 border border-amber-300" : "bg-cyan-500/20",
          overviewRuler: {
            color: idx === nextIdx ? "#f59e0b" : "#06b6d4",
            position: monaco.editor.OverviewRulerLane.Right,
          },
        },
      }));
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
    } catch {
      setMatches([]);
      setInFileMatchStatus(0, 0);
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    }
  }, [
    editor,
    inFileQuery,
    inFileCaseSensitive,
    inFileWholeWord,
    inFileIsRegex,
    setInFileMatchStatus,
  ]);

  useEffect(() => {
    if (inFileFindOpen) {
      updateMatches();
    } else if (editor) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    }
  }, [inFileFindOpen, updateMatches, editor]);

  // Navigate to a specific match index
  const goToMatch = useCallback(
    (idx: number) => {
      if (!editor || matches.length === 0) return;
      const safeIdx = (idx + matches.length) % matches.length;
      setCurrentIndex(safeIdx);
      setInFileMatchStatus(safeIdx + 1, matches.length);

      const targetMatch = matches[safeIdx];
      editor.setSelection(targetMatch.range);
      editor.revealRangeInCenter(targetMatch.range, monaco.editor.ScrollType.Smooth);

      // Update active decoration highlight
      const newDecorations: monaco.editor.IModelDeltaDecoration[] = matches.map((m, i) => ({
        range: m.range,
        options: {
          className: i === safeIdx ? "bg-amber-400/40 border border-amber-300" : "bg-cyan-500/20",
          overviewRuler: {
            color: i === safeIdx ? "#f59e0b" : "#06b6d4",
            position: monaco.editor.OverviewRulerLane.Right,
          },
        },
      }));
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
    },
    [editor, matches, setInFileMatchStatus]
  );

  const handleNext = () => goToMatch(currentIndex + 1);
  const handlePrev = () => goToMatch(currentIndex - 1);

  // Replace single match
  const handleReplaceOne = () => {
    if (!editor || matches.length === 0) return;
    const targetMatch = matches[currentIndex];
    if (!targetMatch) return;

    editor.executeEdits("find-replace", [
      {
        range: targetMatch.range,
        text: inFileReplaceWith,
        forceMoveMarkers: true,
      },
    ]);

    setTimeout(updateMatches, 10);
  };

  // Replace All
  const handleReplaceAll = () => {
    if (!editor || matches.length === 0) return;

    const edits = matches.map((m) => ({
      range: m.range,
      text: inFileReplaceWith,
      forceMoveMarkers: true,
    }));

    editor.executeEdits("find-replace-all", edits);
    setTimeout(updateMatches, 10);
  };

  if (!inFileFindOpen) return null;

  return (
    <div className="absolute top-2 right-4 z-30 w-84 max-w-[calc(100vw-40px)] rounded-lg bg-shark-900/95 border border-shark-700 shadow-2xl p-2 text-xs text-shark-200 backdrop-blur select-none animate-in fade-in zoom-in-95 duration-100">
      {/* Find Row */}
      <div className="flex items-center space-x-1">
        <button
          onClick={toggleInFileReplace}
          title={inFileReplaceOpen ? "Hide Replace" : "Show Replace"}
          className="p-1 rounded hover:bg-shark-800 text-shark-400 hover:text-shark-200 transition-colors shrink-0"
        >
          {inFileReplaceOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        <div className="relative flex-1 flex items-center">
          <input
            ref={findInputRef}
            type="text"
            value={inFileQuery}
            onChange={(e) => setInFileQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey) handlePrev();
                else handleNext();
              } else if (e.key === "Escape") {
                e.preventDefault();
                closeInFileFind();
                editor?.focus();
              }
            }}
            placeholder="Find in file..."
            className="w-full bg-shark-950 border border-shark-700 rounded pl-2.5 pr-20 py-1 text-xs text-white placeholder-shark-500 focus:outline-none focus:border-cyan-500 font-mono"
          />

          {/* Toggle buttons inside input */}
          <div className="absolute right-1 flex items-center space-x-0.5 text-shark-400">
            <button
              type="button"
              onClick={toggleInFileCaseSensitive}
              title="Match Case (Alt+C)"
              className={`p-0.5 rounded hover:bg-shark-800 transition-colors ${
                inFileCaseSensitive ? "bg-cyan-950 text-cyan-400 font-bold" : ""
              }`}
            >
              <CaseSensitive className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={toggleInFileWholeWord}
              title="Match Whole Word (Alt+W)"
              className={`p-0.5 rounded hover:bg-shark-800 transition-colors ${
                inFileWholeWord ? "bg-cyan-950 text-cyan-400 font-bold" : ""
              }`}
            >
              <WholeWord className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={toggleInFileIsRegex}
              title="Use Regular Expression (Alt+R)"
              className={`p-0.5 rounded hover:bg-shark-800 transition-colors ${
                inFileIsRegex ? "bg-cyan-950 text-cyan-400 font-bold" : ""
              }`}
            >
              <Regex className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Match Count Badge */}
        <span className="text-[11px] font-mono text-shark-400 px-1 shrink-0 min-w-10 text-center">
          {inFileQuery ? (matches.length > 0 ? `${inFileMatchIndex}/${inFileTotalMatches}` : "No results") : ""}
        </span>

        {/* Prev / Next buttons */}
        <button
          onClick={handlePrev}
          disabled={matches.length === 0}
          title="Previous Match (Shift+Enter)"
          className="p-1 rounded hover:bg-shark-800 disabled:opacity-30 text-shark-400 hover:text-shark-200 transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={handleNext}
          disabled={matches.length === 0}
          title="Next Match (Enter)"
          className="p-1 rounded hover:bg-shark-800 disabled:opacity-30 text-shark-400 hover:text-shark-200 transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
        </button>

        {/* Close button */}
        <button
          onClick={() => {
            closeInFileFind();
            editor?.focus();
          }}
          title="Close (Escape)"
          className="p-1 rounded hover:bg-shark-800 text-shark-400 hover:text-shark-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Replace Row */}
      {inFileReplaceOpen && (
        <div className="flex items-center space-x-1.5 mt-1.5 pl-6">
          <input
            type="text"
            value={inFileReplaceWith}
            onChange={(e) => setInFileReplaceWith(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.ctrlKey || e.altKey) {
                  handleReplaceAll();
                } else {
                  handleReplaceOne();
                }
              } else if (e.key === "Escape") {
                e.preventDefault();
                closeInFileFind();
                editor?.focus();
              }
            }}
            placeholder="Replace..."
            className="flex-1 bg-shark-950 border border-shark-700 rounded px-2.5 py-1 text-xs text-white placeholder-shark-500 focus:outline-none focus:border-cyan-500 font-mono"
          />

          <button
            onClick={handleReplaceOne}
            disabled={matches.length === 0}
            title="Replace (Enter)"
            className="px-2 py-1 rounded bg-shark-800 hover:bg-shark-700 disabled:opacity-40 text-shark-200 hover:text-white transition-colors shrink-0 text-[11px]"
          >
            Replace
          </button>
          <button
            onClick={handleReplaceAll}
            disabled={matches.length === 0}
            title="Replace All (Ctrl+Alt+Enter)"
            className="flex items-center space-x-1 px-2 py-1 rounded bg-cyan-600/80 hover:bg-cyan-600 disabled:opacity-40 text-white font-medium transition-colors shrink-0 text-[11px]"
          >
            <ReplaceAll className="w-3.5 h-3.5" />
            <span>All</span>
          </button>
        </div>
      )}
    </div>
  );
};
