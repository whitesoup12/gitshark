import React, { useRef, useEffect, useCallback } from "react";
import Editor, { type OnMount, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { Code, FolderPlus, FilePlus } from "lucide-react";
import { useCodeSharkStore } from "../store/useCodeSharkStore";
import { pickDirectory, pickFile } from "@/lib/ipc";
import { computeLineDiff } from "../utils/diff";

// Configure Monaco to use locally bundled instance instead of remote CDN
loader.config({ monaco });

// Configure TypeScript and JavaScript language service in Monaco to silence missing module / import squigglies
const monacoTs = (monaco.languages as any)?.typescript;
if (monacoTs) {
  const codesToIgnore = [
    2307, // Cannot find module '...' or its corresponding type declarations
    2304, // Cannot find name '...'
    2580, // Cannot find name 'require' / 'module' / 'process'
    2593, // Cannot find name '...' Do you need to install type definitions?
    7016, // Could not find a declaration file for module '...'
    2686, // 'React' refers to a UMD global, but the current file is a module
    2792, // Cannot find module '...'. Did you mean to set the 'moduleResolution' option
    80001, // File is a CommonJS module; it may be converted to an ES module
    1375, // 'await' expressions are only allowed at the top level
    1378,
  ];

  monacoTs.typescriptDefaults?.setDiagnosticsOptions({
    noSemanticValidation: true, // Default to clean syntax-only linting to eliminate missing import squigglies
    noSyntaxValidation: false,
    diagnosticCodesToIgnore: codesToIgnore,
  });

  monacoTs.javascriptDefaults?.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
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
  } = useCodeSharkStore();

  // Dynamically update diagnostic options when quietLinting toggle changes
  useEffect(() => {
    const ts = (monaco.languages as any)?.typescript;
    if (ts) {
      const codesToIgnore = [2307, 2304, 2580, 2593, 7016, 2686, 2792, 80001, 1375, 1378];
      ts.typescriptDefaults?.setDiagnosticsOptions({
        noSemanticValidation: quietLinting,
        noSyntaxValidation: false,
        diagnosticCodesToIgnore: codesToIgnore,
      });
      ts.javascriptDefaults?.setDiagnosticsOptions({
        noSemanticValidation: quietLinting,
        noSyntaxValidation: false,
        diagnosticCodesToIgnore: codesToIgnore,
      });
    }
  }, [quietLinting]);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);

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

  // Synchronize decorations when tab content, git head, or active tab changes
  useEffect(() => {
    updateDecorations();
  }, [updateDecorations, activeTab?.path]);

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos(e.position.lineNumber, e.position.column);
    });

    // Custom Ctrl+S / Cmd+S keybinding directly in Monaco
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      saveFile();
    });

    // Initial render of line decorations
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
              <kbd className="px-1.5 py-0.5 rounded bg-shark-900 border border-shark-700 text-shark-300 font-mono">Ctrl + S</kbd>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-shark-400">Close Tab</span>
              <kbd className="px-1.5 py-0.5 rounded bg-shark-900 border border-shark-700 text-shark-300 font-mono">Ctrl + W</kbd>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-shark-400">Toggle Explorer</span>
              <kbd className="px-1.5 py-0.5 rounded bg-shark-900 border border-shark-700 text-shark-300 font-mono">Ctrl + B</kbd>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full relative overflow-hidden bg-shark-950">
      <Editor
        key={activeTab.path}
        path={activeTab.path}
        language={activeTab.language}
        value={activeTab.content}
        onChange={(value) => updateFileContent(activeTab.path, value ?? "")}
        onMount={handleEditorMount}
        theme="vs-dark"
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
          contextmenu: true,
        }}
        loading={
          <div className="flex items-center justify-center h-full text-xs text-shark-400 bg-shark-950">
            Loading editor...
          </div>
        }
      />
    </div>
  );
};
