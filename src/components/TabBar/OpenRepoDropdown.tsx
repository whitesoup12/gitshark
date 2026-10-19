import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  ChevronDown,
  FolderOpen,
  FolderGit2,
  Folder,
  RefreshCw,
  Search,
  Settings,
  FolderPlus,
  X,
  Loader2,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { listDevFoldersIpc, type DevFolderItem } from "@/lib/ipc";

export const OpenRepoDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [folders, setFolders] = useState<DevFolderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { openRepositoryTab, tabs } = useWorkspaceStore();
  const { devDirectory, browseForDevDirectory } = useSettingsStore();

  const loadFolders = async (dir: string) => {
    setIsLoading(true);
    try {
      const items = await listDevFoldersIpc(dir);
      setFolders(items);
    } catch (err) {
      console.warn("Failed to list development folders:", err);
      setFolders([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Compute fixed dropdown position relative to viewport on open/resize
  useLayoutEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const padding = 8;
      const dropdownWidth = 320; // w-80 is 320px
      let left = rect.left;
      if (left + dropdownWidth > window.innerWidth - padding) {
        left = Math.max(padding, window.innerWidth - dropdownWidth - padding);
      }
      setDropdownPos({
        top: rect.bottom + 4,
        left,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && devDirectory) {
      loadFolders(devDirectory);
    }
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen, devDirectory]);

  // Click outside and Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectFolder = (path: string) => {
    setIsOpen(false);
    openRepositoryTab(path);
  };

  const handleBrowseDifferent = () => {
    setIsOpen(false);
    openRepositoryTab();
  };

  const handleChangeDevDir = async () => {
    const picked = await browseForDevDirectory();
    if (picked) {
      loadFolders(picked);
    }
  };

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="relative flex-shrink-0">
      {/* Dropdown Toggle Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 h-7 px-2 ml-1 rounded text-xs transition-colors border select-none ${
          isOpen
            ? "bg-shark-800 text-sky-300 border-sky-500/50"
            : "text-slate-400 hover:text-slate-100 hover:bg-shark-850 border-transparent hover:border-shark-750"
        }`}
        title="Open Repository (Ctrl+O)"
      >
        <FolderGit2 className="w-3.5 h-3.5 text-sky-400" />
        <span className="hidden sm:inline font-medium">Open Repo</span>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${
            isOpen ? "rotate-180 text-sky-400" : ""
          }`}
        />
      </button>

      {/* Floating Dropdown Menu (Fixed in Viewport to prevent clipping) */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
          className="fixed z-50 w-72 sm:w-80 bg-shark-900 border border-shark-750 rounded-xl shadow-2xl overflow-hidden text-xs text-slate-200 select-none animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[460px] backdrop-blur-md"
        >
          {/* Header Section */}
          <div className="p-3 border-b border-shark-800 bg-shark-950/70">
            {devDirectory ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                    Development Directory
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => devDirectory && loadFolders(devDirectory)}
                      disabled={isLoading}
                      className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-shark-800 transition-colors"
                      title="Refresh folders"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${isLoading ? "animate-spin text-sky-400" : ""}`}
                      />
                    </button>
                    <button
                      onClick={handleChangeDevDir}
                      className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-shark-800 transition-colors"
                      title="Change development directory"
                    >
                      <Settings className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div
                  className="font-mono text-[11px] text-slate-300 truncate bg-shark-900 px-2 py-1 rounded border border-shark-800"
                  title={devDirectory}
                >
                  {devDirectory}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex-shrink-0 mt-0.5">
                    <FolderPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-100 text-xs">
                      Set Development Directory
                    </div>
                    <div className="text-[11px] text-slate-400 leading-snug mt-0.5">
                      Specify your development folder to turn this into a dropdown of all your projects.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleChangeDevDir}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Set Dev Directory</span>
                  </button>
                  <button
                    onClick={handleBrowseDifferent}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-shark-800 hover:bg-shark-750 text-slate-200 border border-shark-700 font-medium text-xs transition-colors cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Open Other...</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search Filter Bar (when devDirectory is set and folders exist) */}
          {devDirectory && folders.length > 0 && (
            <div className="p-2 border-b border-shark-800 bg-shark-950/30">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter folders..."
                  className="w-full pl-8 pr-7 py-1 bg-shark-900 border border-shark-750 focus:border-sky-500 rounded text-xs font-mono text-slate-200 outline-none placeholder:text-slate-500"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Folder List */}
          {devDirectory && (
            <div className="flex-1 overflow-y-auto p-1 space-y-0.5 min-h-[60px] max-h-56">
              {isLoading ? (
                <div className="flex items-center justify-center py-6 text-slate-500 gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                  <span className="text-xs">Scanning folders...</span>
                </div>
              ) : filteredFolders.length > 0 ? (
                filteredFolders.map((folder) => {
                  const isAlreadyOpen = tabs.some(
                    (t) =>
                      t.path &&
                      t.path.toLowerCase() === folder.path.toLowerCase()
                  );

                  return (
                    <button
                      key={folder.path}
                      onClick={() => handleSelectFolder(folder.path)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors hover:bg-shark-800 text-slate-300 hover:text-slate-100 group cursor-pointer"
                      title={folder.path}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 mr-2">
                        {folder.is_git_repo ? (
                          <FolderGit2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                        ) : (
                          <Folder className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        )}
                        <span className="font-mono text-xs truncate">
                          {folder.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isAlreadyOpen && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800/60 font-medium">
                            open
                          </span>
                        )}
                        {folder.is_git_repo && !isAlreadyOpen && (
                          <span className="text-[9px] font-mono text-slate-500 group-hover:text-slate-400">
                            git
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-6 text-center text-slate-500 text-xs">
                  {searchQuery ? "No matching folders found" : "No folders found in directory"}
                </div>
              )}
            </div>
          )}

          {/* Footer Actions (when devDirectory is configured) */}
          {devDirectory && (
            <div className="p-1.5 border-t border-shark-800 bg-shark-950/70 space-y-1">
              <button
                onClick={handleBrowseDifferent}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-slate-300 hover:text-slate-100 hover:bg-shark-800 transition-colors cursor-pointer"
                title="Open any repository folder from your filesystem"
              >
                <FolderOpen className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Select Different Repository...</span>
              </button>
              <button
                onClick={handleChangeDevDir}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors cursor-pointer"
                title="Choose a different development directory"
              >
                <Settings className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span>Change Development Directory...</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
