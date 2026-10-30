import React from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  File,
  Loader2,
} from "lucide-react";
import type { FileTreeNode } from "@/types";
import { useCodeSharkStore } from "../store/useCodeSharkStore";
import { normalizePath } from "../utils/language";
import type { FileContextMenuTarget } from "./CodeSharkFileContextMenu";

interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
  projectId?: string;
  onContextMenu?: (target: FileContextMenuTarget, e: React.MouseEvent) => void;
}

function getFileIcon(filename: string, gitStatus?: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (gitStatus === "modified") {
    return <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  }
  if (gitStatus === "untracked" || gitStatus === "new") {
    return <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  }

  switch (ext) {
    case "ts":
    case "tsx":
      return <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    case "js":
    case "jsx":
    case "mjs":
      return <FileCode className="w-3.5 h-3.5 text-amber-300 shrink-0" />;
    case "json":
      return <FileText className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
    case "css":
    case "scss":
    case "less":
      return <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    case "html":
      return <FileCode className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
    case "rs":
      return <FileCode className="w-3.5 h-3.5 text-orange-500 shrink-0" />;
    case "py":
      return <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    case "md":
      return <FileText className="w-3.5 h-3.5 text-shark-300 shrink-0" />;
    case "toml":
    case "yaml":
    case "yml":
      return <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    default:
      return <File className="w-3.5 h-3.5 text-shark-400 shrink-0" />;
  }
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  depth,
  projectId,
  onContextMenu,
}) => {
  const {
    projects,
    projectGitStatus,
    expandedFolders,
    loadingFolders,
    treeNodes,
    toggleFolder,
    openFile,
    activeFilePath,
  } = useCodeSharkStore();

  const normPath = normalizePath(node.path);
  const isExpanded = !!expandedFolders[normPath];
  const isLoading = !!loadingFolders[normPath];
  const children = treeNodes[normPath] || [];
  const isActive = activeFilePath ? normalizePath(activeFilePath) === normPath : false;

  // Determine Git status for this file / folder
  const project = projects.find((p) => p.id === projectId);
  const gitStatusMap = (projectId && projectGitStatus[projectId]) || {};

  let gitStatus: string | undefined;
  let hasModifiedChildren = false;

  if (project) {
    const normProjectRoot = normalizePath(project.path).toLowerCase();
    const normNode = normPath.toLowerCase();

    if (normNode.startsWith(normProjectRoot)) {
      const relPath = normPath.slice(project.path.length).replace(/^[/\\]+/, "");
      const lowerRel = relPath.toLowerCase();

      if (!node.isDir) {
        gitStatus = gitStatusMap[lowerRel] || gitStatusMap[relPath];
      } else {
        const prefix = lowerRel ? `${lowerRel}/` : "";
        for (const k of Object.keys(gitStatusMap)) {
          if (k.toLowerCase().startsWith(prefix)) {
            hasModifiedChildren = true;
            break;
          }
        }
      }
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isDir) {
      toggleFolder(node.path);
    } else {
      openFile(node.path, node.name, projectId);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContextMenu) {
      onContextMenu(
        {
          path: node.path,
          name: node.name,
          isDir: node.isDir,
          projectId,
        },
        e
      );
    }
  };

  return (
    <div className="select-none text-xs">
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className={`flex items-center space-x-1.5 py-1 pr-2 cursor-pointer transition-colors ${
          isActive
            ? "bg-cyan-950/70 text-cyan-200 border-l-2 border-cyan-400"
            : "text-shark-300 hover:bg-shark-800/60 hover:text-shark-100"
        }`}
        title={node.path}
      >
        {node.isDir ? (
          <>
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 text-shark-400 animate-spin shrink-0" />
            ) : isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-shark-400 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-shark-400 shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-shark-400 shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 h-3.5 shrink-0" />
            {getFileIcon(node.name, gitStatus)}
          </>
        )}
        <span
          className={`truncate ${
            gitStatus === "modified"
              ? "text-amber-400 font-medium"
              : gitStatus === "untracked" || gitStatus === "new"
              ? "text-emerald-400 font-medium"
              : gitStatus === "staged"
              ? "text-cyan-400 font-medium"
              : gitStatus === "conflicted"
              ? "text-red-400 font-medium"
              : ""
          }`}
        >
          {node.name}
        </span>

        {/* Git Status Badge */}
        {gitStatus && (
          <span
            title={`Git: ${gitStatus}`}
            className={`ml-auto text-[10px] font-bold px-1 rounded shrink-0 ${
              gitStatus === "modified"
                ? "text-amber-400"
                : gitStatus === "untracked" || gitStatus === "new"
                ? "text-emerald-400"
                : gitStatus === "staged"
                ? "text-cyan-400"
                : "text-red-400"
            }`}
          >
            {gitStatus === "modified"
              ? "M"
              : gitStatus === "untracked" || gitStatus === "new"
              ? "U"
              : gitStatus === "staged"
              ? "S"
              : "!"}
          </span>
        )}

        {/* Folder modified indicator */}
        {node.isDir && hasModifiedChildren && (
          <span
            title="Contains modified files"
            className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400/90 shrink-0"
          />
        )}
      </div>

      {node.isDir && isExpanded && (
        <div>
          {children.length > 0 ? (
            children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                projectId={projectId}
                onContextMenu={onContextMenu}
              />
            ))
          ) : !isLoading ? (
            <div
              style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
              className="py-1 text-[11px] text-shark-500 italic"
            >
              (empty)
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
