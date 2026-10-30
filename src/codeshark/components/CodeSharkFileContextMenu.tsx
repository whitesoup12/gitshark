import React, { useState, useEffect, useRef } from "react";
import {
  FilePlus,
  FolderPlus,
  Edit2,
  Trash2,
  Copy,
  FolderOpen,
  RefreshCw,
  X,
  FileCode,
  Folder,
  AlertTriangle,
} from "lucide-react";
import { useCodeSharkStore } from "../store/useCodeSharkStore";
import { normalizePath } from "../utils/language";

export interface FileContextMenuTarget {
  path: string;
  name: string;
  isDir: boolean;
  isProjectRoot?: boolean;
  projectId?: string;
}

interface CodeSharkFileContextMenuProps {
  target: FileContextMenuTarget;
  x: number;
  y: number;
  onClose: () => void;
}

export const CodeSharkFileContextMenu: React.FC<CodeSharkFileContextMenuProps> = ({
  target,
  x,
  y,
  onClose,
}) => {
  const {
    openFile,
    createFile,
    createDirectory,
    renamePath,
    deletePath,
    duplicateFile,
    revealInFileManager,
    loadFolderEntries,
    refreshGitStatus,
    removeProject,
    projects,
    setStatusMessage,
  } = useCodeSharkStore();

  const [modalMode, setModalMode] = useState<"new-file" | "new-folder" | "rename" | "delete" | null>(null);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Position clamping
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 300);

  // Focus input when modal opens
  useEffect(() => {
    if (modalMode && modalMode !== "delete") {
      setTimeout(() => {
        inputRef.current?.focus();
        if (modalMode === "rename") {
          inputRef.current?.select();
        }
      }, 50);
    }
  }, [modalMode]);

  // Handle outside clicks to close context menu (if no modal is open)
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (modalMode) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (modalMode) {
          setModalMode(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [modalMode, onClose]);

  // Determine relative path for copy relative path
  const project = projects.find((p) => {
    const normProj = normalizePath(p.path).toLowerCase();
    const normTarget = normalizePath(target.path).toLowerCase();
    return normTarget === normProj || normTarget.startsWith(normProj + "/");
  });

  const getRelativePath = () => {
    if (!project) return target.path;
    const normProj = normalizePath(project.path);
    const normTarget = normalizePath(target.path);
    if (normTarget === normProj) return ".";
    return normTarget.slice(normProj.length).replace(/^[/\\]+/, "");
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatusMessage(`Copied ${label} to clipboard`);
    } catch {
      setStatusMessage(`Failed to copy ${label}`);
    }
    onClose();
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = inputValue.trim();
    if (!val && modalMode !== "delete") return;

    if (modalMode === "new-file") {
      await createFile(target.path, val);
    } else if (modalMode === "new-folder") {
      await createDirectory(target.path, val);
    } else if (modalMode === "rename") {
      await renamePath(target.path, val);
    } else if (modalMode === "delete") {
      await deletePath(target.path, target.isDir);
    }

    setModalMode(null);
    onClose();
  };

  return (
    <>
      {/* Context Menu Dropdown */}
      {!modalMode && (
        <div
          ref={menuRef}
          style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
          className="fixed z-50 w-56 rounded-md bg-shark-900 border border-shark-700 shadow-2xl py-1 text-xs text-shark-200 select-none animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header indicator */}
          <div className="px-3 py-1.5 border-b border-shark-800 text-[11px] font-semibold text-shark-400 flex items-center space-x-1.5 truncate">
            {target.isDir ? (
              <Folder className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            ) : (
              <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            )}
            <span className="truncate">{target.name}</span>
          </div>

          {/* Directory / Project root actions */}
          {target.isDir && (
            <>
              <button
                onClick={() => {
                  setInputValue("");
                  setModalMode("new-file");
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-cyan-950/70 hover:text-cyan-200 transition-colors text-left"
              >
                <FilePlus className="w-3.5 h-3.5 text-cyan-400" />
                <span>New File...</span>
              </button>
              <button
                onClick={() => {
                  setInputValue("");
                  setModalMode("new-folder");
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-cyan-950/70 hover:text-cyan-200 transition-colors text-left"
              >
                <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
                <span>New Folder...</span>
              </button>
              <div className="my-1 border-t border-shark-800" />
            </>
          )}

          {/* File specific actions */}
          {!target.isDir && (
            <>
              <button
                onClick={() => {
                  openFile(target.path, target.name, target.projectId);
                  onClose();
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-cyan-950/70 hover:text-cyan-200 transition-colors text-left"
              >
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>Open</span>
              </button>
              <button
                onClick={async () => {
                  await duplicateFile(target.path);
                  onClose();
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-cyan-950/70 hover:text-cyan-200 transition-colors text-left"
              >
                <Copy className="w-3.5 h-3.5 text-shark-400" />
                <span>Duplicate File</span>
              </button>
              <div className="my-1 border-t border-shark-800" />
            </>
          )}

          {/* Rename & Delete (for non-project root items) */}
          {!target.isProjectRoot && (
            <>
              <button
                onClick={() => {
                  setInputValue(target.name);
                  setModalMode("rename");
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-cyan-950/70 hover:text-cyan-200 transition-colors text-left"
              >
                <Edit2 className="w-3.5 h-3.5 text-shark-400" />
                <span>Rename...</span>
              </button>
              <button
                onClick={() => {
                  setModalMode("delete");
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-red-950/70 hover:text-red-300 transition-colors text-left text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Delete...</span>
              </button>
              <div className="my-1 border-t border-shark-800" />
            </>
          )}

          {/* Copy Paths */}
          <button
            onClick={() => handleCopy(target.path, "Full Path")}
            className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-shark-800 hover:text-shark-100 transition-colors text-left"
          >
            <Copy className="w-3.5 h-3.5 text-shark-400" />
            <span>Copy Path</span>
          </button>
          <button
            onClick={() => handleCopy(getRelativePath(), "Relative Path")}
            className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-shark-800 hover:text-shark-100 transition-colors text-left"
          >
            <Copy className="w-3.5 h-3.5 text-shark-400" />
            <span>Copy Relative Path</span>
          </button>
          {!target.isDir && (
            <button
              onClick={() => handleCopy(target.name, "File Name")}
              className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-shark-800 hover:text-shark-100 transition-colors text-left"
            >
              <Copy className="w-3.5 h-3.5 text-shark-400" />
              <span>Copy Filename</span>
            </button>
          )}

          <div className="my-1 border-t border-shark-800" />

          {/* System Reveal & Refresh */}
          <button
            onClick={async () => {
              await revealInFileManager(target.path);
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-shark-800 hover:text-shark-100 transition-colors text-left"
          >
            <FolderOpen className="w-3.5 h-3.5 text-shark-400" />
            <span>Reveal in File Explorer</span>
          </button>

          {target.isDir && (
            <button
              onClick={async () => {
                await loadFolderEntries(target.path);
                if (target.projectId) {
                  await refreshGitStatus(target.projectId);
                }
                onClose();
              }}
              className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-shark-800 hover:text-shark-100 transition-colors text-left"
            >
              <RefreshCw className="w-3.5 h-3.5 text-shark-400" />
              <span>Refresh Folder</span>
            </button>
          )}

          {target.isProjectRoot && target.projectId && (
            <>
              <div className="my-1 border-t border-shark-800" />
              <button
                onClick={() => {
                  removeProject(target.projectId!);
                  onClose();
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-red-950/70 hover:text-red-300 transition-colors text-left text-red-400"
              >
                <X className="w-3.5 h-3.5 text-red-400" />
                <span>Remove Folder from Workspace</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Action Dialog / Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-lg bg-shark-900 border border-shark-700 p-4 shadow-2xl text-shark-100 select-none animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-shark-800 mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                {modalMode === "new-file" && (
                  <>
                    <FilePlus className="w-4 h-4 text-cyan-400" />
                    <span>New File</span>
                  </>
                )}
                {modalMode === "new-folder" && (
                  <>
                    <FolderPlus className="w-4 h-4 text-cyan-400" />
                    <span>New Folder</span>
                  </>
                )}
                {modalMode === "rename" && (
                  <>
                    <Edit2 className="w-4 h-4 text-cyan-400" />
                    <span>Rename</span>
                  </>
                )}
                {modalMode === "delete" && (
                  <>
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => {
                  setModalMode(null);
                  onClose();
                }}
                className="p-1 rounded hover:bg-shark-800 text-shark-400 hover:text-shark-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalMode === "delete" ? (
              <div className="space-y-3">
                <p className="text-xs text-shark-300">
                  Are you sure you want to permanently delete{" "}
                  <strong className="text-white font-mono">{target.name}</strong>?
                </p>
                <p className="text-[11px] text-red-400/90 bg-red-950/40 border border-red-900/50 p-2 rounded">
                  This action cannot be undone. All changes will be lost.
                </p>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalMode(null);
                      onClose();
                    }}
                    className="px-3 py-1.5 text-xs rounded bg-shark-800 hover:bg-shark-700 text-shark-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitModal}
                    className="px-3 py-1.5 text-xs rounded bg-red-600 hover:bg-red-500 text-white font-medium transition-colors shadow"
                  >
                    Delete Permanently
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitModal} className="space-y-3">
                <div>
                  <label className="block text-[11px] text-shark-400 mb-1">
                    {modalMode === "new-file"
                      ? "File name (e.g. index.ts, style.css):"
                      : modalMode === "new-folder"
                      ? "Folder name:"
                      : "New name:"}
                  </label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={modalMode === "new-file" ? "filename.ext" : "folder-name"}
                    className="w-full px-2.5 py-1.5 text-xs rounded bg-shark-950 border border-shark-700 text-shark-100 placeholder-shark-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setModalMode(null);
                      onClose();
                    }}
                    className="px-3 py-1.5 text-xs rounded bg-shark-800 hover:bg-shark-700 text-shark-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="px-3 py-1.5 text-xs rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium transition-colors shadow"
                  >
                    {modalMode === "rename" ? "Rename" : "Create"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
