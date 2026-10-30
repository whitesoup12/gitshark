import React, { useRef, useEffect, useState, useCallback } from "react";
import Editor, { type OnMount, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { Code, FolderPlus, FilePlus } from "lucide-react";
import { useCodeSharkStore } from "../store/useCodeSharkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { registerMonacoThemes, THEMES } from "@/lib/theme";
import { pickDirectory, pickFile } from "@/lib/ipc";
import { computeLineDiff } from "../utils/diff";
import { normalizePath } from "../utils/language";
import { CodeSharkFindReplaceBar } from "./CodeSharkFindReplaceBar";
import { CodeSharkEditorContextMenu } from "./CodeSharkEditorContextMenu";

// Configure Monaco to use locally bundled instance instead of remote CDN
loader.config({ monaco });

// Configure TypeScript and JavaScript language service in Monaco to silence missing module / import squigglies
const monacoTs = (monaco.languages as any)?.typescript;
if (monacoTs) {
  const codesToIgnore = [
    2307, 2304, 2580, 2593, 7016, 2686, 2792, 80001, 1375, 1378,
  ];

  monacoTs.typescriptDefaults?.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
    diagnosticCodesToIgnore: codesToIgnore,
  });

  monacoTs.javascriptDefaults?.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
    diagnosticCodesToIgnore: codesToIgnore,
  });

  const compilerOpts = {
    target: monacoTs.ScriptTarget?.ESNext ?? 99,
    allowNonTextExtensions: true,
    moduleResolution: monacoTs.ModuleResolutionKind?.NodeJs ?? 2,
    module: monacoTs.ModuleKind?.ESNext ?? 99,
    noEmit: true,
    esModuleInterop: true,
    jsx: monacoTs.JsxEmit?.ReactJSX ?? 4,
    reactNamespace: "React",
    allowJs: true,
    checkJs: false,
    skipLibCheck: true,
  };

  monacoTs.typescriptDefaults?.setCompilerOptions(compilerOpts);
  monacoTs.javascriptDefaults?.setCompilerOptions(compilerOpts);
}

const monacoJson = (monaco.languages as any)?.json;
if (monacoJson) {
  monacoJson.jsonDefaults?.setDiagnosticsOptions({
    validate: false,
    allowComments: true,
  });
}

const monacoCss = (monaco.languages as any)?.css;
if (monacoCss) {
  monacoCss.cssDefaults?.setDiagnosticsOptions({
    validate: false,
  });
}

export const CodeSharkEditor: React.FC = () => {
  const {
    openTabs,
    activeFilePath,
    updateFileContent,
    saveFile,
    setCursorPos,
    addProjectFolder,
    openTarget,
    quietLinting,
    jumpToLocation,
    openInFileFind,
    setSidebarTab,
    setSearchQuery,
    executeGlobalSearch,
    openQuickOpen,
  } = useCodeSharkStore();

  const { currentTheme } = useSettingsStore();
  const activeThemeDef = THEMES.find((t) => t.id === currentTheme) || THEMES[0];

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const [editorContextMenu, setEditorContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Sync theme changes with Monaco
  useEffect(() => {
    try {
      registerMonacoThemes(monaco);
      monaco.editor.setTheme(activeThemeDef.monacoTheme);
    } catch {
      // editor not mounted yet
    }
  }, [activeThemeDef.monacoTheme]);

  // Dynamically update diagnostic options when quietLinting changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        renderValidationDecorations: quietLinting ? "off" : "on",
      });
    }

    const ts = (monaco.languages as any)?.typescript;
    if (ts) {
      const codesToIgnore = [2307, 2304, 2580, 2593, 7016, 2686, 2792, 80001, 1375, 1378];
      ts.typescriptDefaults?.setDiagnosticsOptions({
        noSemanticValidation: quietLinting,
        noSyntaxValidation: quietLinting,
        diagnosticCodesToIgnore: codesToIgnore,
      });
      ts.javascriptDefaults?.setDiagnosticsOptions({
        noSemanticValidation: quietLinting,
        noSyntaxValidation: quietLinting,
        diagnosticCodesToIgnore: codesToIgnore,
      });
    }

    const json = (monaco.languages as any)?.json;
    if (json) {
      json.jsonDefaults?.setDiagnosticsOptions({
        validate: !quietLinting,
        allowComments: true,
      });
    }

    const css = (monaco.languages as any)?.css;
    if (css) {
      css.cssDefaults?.setDiagnosticsOptions({
        validate: !quietLinting,
      });
    }

    if (quietLinting) {
      try {
        monaco.editor.getModels().forEach((model) => {
          monaco.editor.setModelMarkers(model, "typescript", []);
          monaco.editor.setModelMarkers(model, "javascript", []);
          monaco.editor.setModelMarkers(model, "json", []);
          monaco.editor.setModelMarkers(model, "css", []);
          monaco.editor.setModelMarkers(model, "html", []);
        });
      } catch (err) {
        console.warn("Could not clear Monaco markers:", err);
      }
    }
  }, [quietLinting]);

  const activeTab = openTabs.find((t) => t.path === activeFilePath);

  // Update line change gutter indicators
  const updateDecorations = useCallback(() => {
    if (!editorRef.current || !activeTab) return;

    const baseText = activeTab.gitHeadContent ?? activeTab.originalContent;
    const changes = computeLineDiff(baseText, activeTab.content);

    const newDecorations: monaco.editor.IModelDeltaDecoration[] = changes.map((change) => ({
      range: new monaco.Range(change.lineNumber, 1, change.lineNumber, 1),
      options: {
        isWholeLine: false,
        linesDecorationsClassName:
          change.type === "added"
            ? "git-gutter-added"
            : change.type === "modified"
            ? "git-gutter-modified"
            : "git-gutter-deleted",
        overviewRuler: {
          color:
            change.type === "added"
              ? "#10b981"
              : change.type === "modified"
              ? "#06b6d4"
              : "#ef4444",
          position: monaco.editor.OverviewRulerLane.Right,
        },
      },
    }));

    decorationsRef.current = editorRef.current.deltaDecorations(
      decorationsRef.current,
      newDecorations
    );
  }, [activeTab?.content, activeTab?.gitHeadContent, activeTab?.originalContent]);

  useEffect(() => {
    updateDecorations();
  }, [updateDecorations, activeTab?.path]);

  // Jump to location navigation from global search
  useEffect(() => {
    if (!jumpToLocation || !editorRef.current || !activeTab) return;

    const normJump = normalizePath(jumpToLocation.filePath);
    const normActive = normalizePath(activeTab.path);

    if (normJump === normActive) {
      const editor = editorRef.current;
      const line = jumpToLocation.line;
      const startCol = jumpToLocation.col ?? 1;
      const endCol = jumpToLocation.endCol ?? startCol;

      editor.setPosition({ lineNumber: line, column: startCol });
      const range = new monaco.Range(line, startCol, line, endCol);
      editor.setSelection(range);
      editor.revealRangeInCenter(range, monaco.editor.ScrollType.Smooth);
      editor.focus();

      // Temporary pulse decoration
      const flashDecorations = editor.deltaDecorations([], [
        {
          range,
          options: {
            isWholeLine: false,
            className: "bg-cyan-400/50 border border-cyan-300 font-semibold",
          },
        },
      ]);

      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.deltaDecorations(flashDecorations, []);
        }
      }, 1500);
    }
  }, [jumpToLocation, activeTab?.path]);

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;

    // Register all custom CodeShark themes and apply current theme
    registerMonacoThemes(monacoInstance);
    monacoInstance.editor.setTheme(activeThemeDef.monacoTheme);

    editor.updateOptions({
      renderValidationDecorations: quietLinting ? "off" : "on",
    });

    if (quietLinting) {
      const model = editor.getModel();
      if (model) {
        monacoInstance.editor.setModelMarkers(model, "typescript", []);
        monacoInstance.editor.setModelMarkers(model, "javascript", []);
        monacoInstance.editor.setModelMarkers(model, "json", []);
        monacoInstance.editor.setModelMarkers(model, "css", []);
        monacoInstance.editor.setModelMarkers(model, "html", []);
      }
    }

    // Cursor position tracking
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos(e.position.lineNumber, e.position.column);
    });

    // Custom Right-Click Context Menu interceptor
    editor.onContextMenu((e) => {
      e.event.preventDefault();
      e.event.stopPropagation();
      setEditorContextMenu({
        x: e.event.posx,
        y: e.event.posy,
      });
    });

    // Keyboard Shortcuts inside Monaco
    // Save: Ctrl+S / Cmd+S
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      saveFile();
    });

    // Find in file: Ctrl+F / Cmd+F
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyF, () => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      const text = selection && model && !selection.isEmpty() ? model.getValueInRange(selection) : "";
      openInFileFind(false, text || undefined);
    });

    // Replace in file: Ctrl+H / Cmd+H
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyH, () => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      const text = selection && model && !selection.isEmpty() ? model.getValueInRange(selection) : "";
      openInFileFind(true, text || undefined);
    });

    // Find in Files / Global Search: Ctrl+Shift+F / Cmd+Shift+F
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyF,
      () => {
        const selection = editor.getSelection();
        const model = editor.getModel();
        const text = selection && model && !selection.isEmpty() ? model.getValueInRange(selection) : "";
        setSidebarTab("search");
        if (text) {
          setSearchQuery(text);
          setTimeout(executeGlobalSearch, 50);
        }
      }
    );

    // Quick Open Files: Ctrl+P / Cmd+P
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyP, () => {
      openQuickOpen();
    });

    setTimeout(updateDecorations, 50);
  };

  const handleAddFolder = async () => {
    const dir = await pickDirectory("Add Folder to Workspace");
    if (dir) {
      await addProjectFolder(dir);
    }
  };

  const handleOpenFile = async () => {
    const file = await pickFile("Open File");
    if (file) {
      await openTarget(file);
    }
  };

  if (!activeTab) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-shark-950 text-shark-300 p-8 select-none">
        <div className="flex flex-col items-center max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/50">
            <Code className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">CodeShark</h2>
            <p className="text-xs text-shark-400 mt-1">
              Lightweight, fast IDE built right into GitShark
            </p>
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <button
              onClick={handleAddFolder}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium shadow transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Add Folder</span>
            </button>
            <button
              onClick={handleOpenFile}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded bg-shark-800 hover:bg-shark-700 text-shark-200 border border-shark-700 font-medium transition-colors"
            >
              <FilePlus className="w-4 h-4 text-cyan-400" />
              <span>Open File</span>
            </button>
          </div>

          <div className="pt-6 border-t border-shark-800/80 w-full text-xs text-shark-400 space-y-2">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-shark-400">Save File</span>
              <kbd className="px-1.5 py-0.5 rounded bg-shark-900 border border-shark-700 text-shark-300 font-mono">
                Ctrl + S
              </kbd>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-shark-400">Find in File / Replace</span>
              <kbd className="px-1.5 py-0.5 rounded bg-shark-900 border border-shark-700 text-shark-300 font-mono">
                Ctrl + F / Ctrl + H
              </kbd>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-shark-400">Global Workspace Search</span>
              <kbd className="px-1.5 py-0.5 rounded bg-shark-900 border border-shark-700 text-shark-300 font-mono">
                Ctrl + Shift + F
              </kbd>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-shark-400">Quick Open File</span>
              <kbd className="px-1.5 py-0.5 rounded bg-shark-900 border border-shark-700 text-shark-300 font-mono">
                Ctrl + P
              </kbd>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-shark-400">Toggle Explorer</span>
              <kbd className="px-1.5 py-0.5 rounded bg-shark-900 border border-shark-700 text-shark-300 font-mono">
                Ctrl + B
              </kbd>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full relative overflow-hidden bg-shark-950">
      {/* Floating In-File Find and Replace Bar */}
      <CodeSharkFindReplaceBar editor={editorRef.current} />

      <Editor
        key={activeTab.path}
        path={activeTab.path}
        language={activeTab.language}
        value={activeTab.content}
        onChange={(value) => updateFileContent(activeTab.path, value ?? "")}
        onMount={handleEditorMount}
        theme={activeThemeDef.monacoTheme}
        options={{
          minimap: { enabled: true },
          fontSize: 13.5,
          fontFamily: "'Cascadia Code', 'Fira Code', Consolas, 'Courier New', monospace",
          fontLigatures: true,
          lineNumbers: "on",
          lineDecorationsWidth: 10,
          roundedSelection: false,
          scrollBeyondLastLine: false,
          readOnly: false,
          automaticLayout: true,
          wordWrap: "on",
          tabSize: 2,
          padding: { top: 10, bottom: 10 },
          cursorBlinking: "smooth",
          smoothScrolling: true,
          contextmenu: false, // Handled by our custom CodeSharkEditorContextMenu
          renderValidationDecorations: quietLinting ? "off" : "on",
        }}
        loading={
          <div className="flex items-center justify-center h-full text-xs text-shark-400 bg-shark-950">
            Loading editor...
          </div>
        }
      />

      {/* Editor Content Right-Click Context Menu */}
      {editorContextMenu && activeTab && (
        <CodeSharkEditorContextMenu
          x={editorContextMenu.x}
          y={editorContextMenu.y}
          editor={editorRef.current}
          activeFilePath={activeTab.path}
          onClose={() => setEditorContextMenu(null)}
        />
      )}
    </div>
  );
};
