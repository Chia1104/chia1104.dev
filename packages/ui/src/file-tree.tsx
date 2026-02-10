"use client";

import { useState, useMemo, useCallback } from "react";

import { Button, ScrollShadow } from "@heroui/react";
import { Breadcrumbs } from "@heroui/react";
import { Chip } from "@heroui/react";
import { Separator } from "@heroui/react";
import { Disclosure } from "@heroui/react";
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  FileCode,
  FileJson,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileSpreadsheet,
  FileType,
  ChevronsUpDown,
} from "lucide-react";

import { cn } from "../utils/cn.util";

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
  children?: TreeNode[];
}

export interface R2ObjectItem {
  key: string;
  size: number;
}

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp", "tiff"].includes(
      ext
    )
  ) {
    return <FileImage className="size-4 text-green-500" />;
  }

  if (["mp4", "webm", "mov", "avi", "mkv", "flv", "wmv"].includes(ext)) {
    return <FileVideo className="size-4 text-purple-500" />;
  }

  if (["mp3", "wav", "ogg", "flac", "aac", "wma", "m4a"].includes(ext)) {
    return <FileAudio className="size-4 text-pink-500" />;
  }

  if (
    [
      "js",
      "ts",
      "jsx",
      "tsx",
      "py",
      "rb",
      "go",
      "rs",
      "java",
      "c",
      "cpp",
      "h",
      "hpp",
      "cs",
      "php",
      "swift",
      "kt",
    ].includes(ext)
  ) {
    return <FileCode className="size-4 text-blue-500" />;
  }

  if (ext === "json") {
    return <FileJson className="size-4 text-yellow-500" />;
  }

  if (["txt", "md", "mdx", "rst", "log"].includes(ext)) {
    return <FileText className="size-4 text-gray-500" />;
  }

  if (["zip", "tar", "gz", "rar", "7z", "bz2"].includes(ext)) {
    return <FileArchive className="size-4 text-amber-600" />;
  }

  if (["csv", "xlsx", "xls", "ods"].includes(ext)) {
    return <FileSpreadsheet className="size-4 text-emerald-600" />;
  }

  if (ext === "pdf") {
    return <FileType className="size-4 text-red-500" />;
  }

  if (["html", "htm", "css", "scss", "sass", "less"].includes(ext)) {
    return <FileCode className="size-4 text-orange-500" />;
  }

  if (["yaml", "yml", "toml", "ini", "env", "config"].includes(ext)) {
    return <FileText className="size-4 text-slate-500" />;
  }

  return <File className="text-muted-foreground size-4" />;
}

export function buildFileTree(
  objects: R2ObjectItem[],
  hideKeepFiles = true
): TreeNode[] {
  const root: TreeNode[] = [];

  const filteredObjects = hideKeepFiles
    ? objects.filter(
        (obj) => !obj.key.endsWith("/.keep") && obj.key !== ".keep"
      )
    : objects;

  for (const obj of filteredObjects) {
    const parts = obj.key.split("/");
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");

      let existing = currentLevel.find((node) => node.name === part);

      if (!existing) {
        const newNode: TreeNode = {
          name: part,
          path: currentPath,
          type: isFile ? "file" : "folder",
          ...(isFile && { size: obj.size }),
          ...(!isFile && { children: [] }),
        };
        currentLevel.push(newNode);
        existing = newNode;
      }

      if (!isFile && existing.children) {
        currentLevel = existing.children;
      }
    }
  }

  if (hideKeepFiles) {
    for (const obj of objects) {
      if (obj.key.endsWith("/.keep")) {
        const folderPath = obj.key.replace("/.keep", "");
        const parts = folderPath.split("/");
        let currentLevel = root;

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (!part) continue;

          const currentPath = parts.slice(0, i + 1).join("/");
          let existing = currentLevel.find((node) => node.name === part);

          if (!existing) {
            const newNode: TreeNode = {
              name: part,
              path: currentPath,
              type: "folder",
              children: [],
            };
            currentLevel.push(newNode);
            existing = newNode;
          }

          if (existing.children) {
            currentLevel = existing.children;
          }
        }
      }
    }
  }

  // Sort: folders first, then files, both alphabetically
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "folder" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      })
      .map((node) => {
        if (node.children) {
          node.children = sortNodes(node.children);
        }
        return node;
      });
  };

  return sortNodes(root);
}

interface TreeNodeComponentProps {
  node: TreeNode;
  level: number;
  selectedPath: string | null;
  onSelect: (path: string, type: "file" | "folder") => void;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
}

const TreeNodeComponent = ({
  node,
  level,
  selectedPath,
  onSelect,
  expandedFolders,
  onToggleFolder,
}: TreeNodeComponentProps) => {
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedPath === node.path;
  const isFolder = node.type === "folder";
  const childCount = node.children?.length || 0;

  const handleSelect = useCallback(() => {
    onSelect(node.path, node.type);
  }, [node.path, node.type, onSelect]);

  if (isFolder) {
    return (
      <div className="select-none">
        <Disclosure
          isExpanded={isExpanded}
          onExpandedChange={(isOpen) => {
            if (isOpen !== isExpanded) {
              onToggleFolder(node.path);
            }
          }}>
          <Disclosure.Heading>
            <Button
              data-level={level}
              variant={isSelected ? "secondary" : "ghost"}
              slot="trigger"
              className={cn(
                "group h-auto w-full justify-start gap-1 rounded-md px-2 py-1.5 text-sm transition-all duration-150 data-[level=0]:ml-0 data-[level=1]:ml-1 data-[level=2]:ml-2 data-[level=3]:ml-3"
              )}
              onPress={handleSelect}>
              {/* Expand/Collapse indicator */}
              <Disclosure.Indicator className="mr-1 size-3.5 shrink-0" />

              {/* Folder icon */}
              <span className="shrink-0">
                {isExpanded ? (
                  <FolderOpen className="size-4 text-amber-500" />
                ) : (
                  <Folder className="size-4 text-amber-500" />
                )}
              </span>

              {/* Folder name */}
              <span className="truncate font-medium">{node.name}</span>

              {/* Item count badge */}
              <Chip
                size="sm"
                variant="soft"
                className="ml-auto opacity-60 transition-opacity group-hover:opacity-100">
                {childCount}
              </Chip>
            </Button>
          </Disclosure.Heading>

          <Disclosure.Content>
            <Disclosure.Body>
              {node.children?.map((child) => (
                <TreeNodeComponent
                  key={child.path}
                  node={child}
                  level={level + 1}
                  selectedPath={selectedPath}
                  onSelect={onSelect}
                  expandedFolders={expandedFolders}
                  onToggleFolder={onToggleFolder}
                />
              ))}
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      </div>
    );
  }

  // File node
  return (
    <Button
      data-level={level}
      variant={isSelected ? "secondary" : "ghost"}
      className={cn(
        "h-auto w-full justify-start gap-1.5 rounded-md px-2 py-1.5 text-sm transition-all duration-150 data-[level=0]:ml-0 data-[level=1]:ml-1 data-[level=2]:ml-2 data-[level=3]:ml-3"
      )}
      onPress={handleSelect}>
      <span className="shrink-0">{getFileIcon(node.name)}</span>
      <span className="truncate">{node.name}</span>
      {node.size !== undefined && (
        <span className="text-muted-foreground ml-auto shrink-0 text-[10px] tabular-nums">
          {formatBytes(node.size)}
        </span>
      )}
    </Button>
  );
};

interface BreadcrumbProps {
  path: string | null;
  onNavigate: (path: string | null) => void;
}

const Breadcrumb = ({ path, onNavigate }: BreadcrumbProps) => {
  const breadcrumbItems = useMemo(() => {
    if (!path) return null;

    const parts = path.split("/");
    const breadcrumbs = parts.slice(0, -1);

    if (breadcrumbs.length === 0) return null;

    return [
      {
        key: "root",
        label: "Root",
        path: null,
      },
      ...breadcrumbs.map((part, index) => {
        const partPath = parts.slice(0, index + 1).join("/");
        return {
          key: partPath,
          label: part,
          path: partPath,
        };
      }),
    ];
  }, [path]);

  if (!breadcrumbItems) return null;

  return (
    <Breadcrumbs className="text-xs">
      {breadcrumbItems.map((item) => (
        <Breadcrumbs.Item
          key={item.key}
          onPress={() => onNavigate(item.path)}
          className="text-xs">
          {item.label}
        </Breadcrumbs.Item>
      ))}
    </Breadcrumbs>
  );
};

// Main FileTree component
interface FileTreeProps {
  objects: R2ObjectItem[];
  selectedPath?: string | null;
  onSelect?: (path: string, type: "file" | "folder") => void;
  className?: string;
}

export function FileTree({
  objects,
  selectedPath,
  onSelect,
  className,
}: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );

  const tree = useMemo(() => buildFileTree(objects, true), [objects]);

  const handleToggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const expandToPath = useCallback((path: string) => {
    const parts = path.split("/");
    const foldersToExpand: string[] = [];
    for (let i = 0; i < parts.length - 1; i++) {
      foldersToExpand.push(parts.slice(0, i + 1).join("/"));
    }
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      foldersToExpand.forEach((f) => next.add(f));
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (path: string, type: "file" | "folder") => {
      if (type === "file") {
        expandToPath(path);
      }
      onSelect?.(path, type);
    },
    [expandToPath, onSelect]
  );

  const handleBreadcrumbNavigate = useCallback(
    (path: string | null) => {
      if (path) {
        expandToPath(path + "/x");
        onSelect?.(path, "folder");
      }
    },
    [expandToPath, onSelect]
  );

  const expandAll = useCallback(() => {
    const allFolders = new Set<string>();
    const collectFolders = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.type === "folder") {
          allFolders.add(node.path);
          if (node.children) {
            collectFolders(node.children);
          }
        }
      }
    };
    collectFolders(tree);
    setExpandedFolders(allFolders);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpandedFolders(new Set());
  }, []);

  const hasAnyFolders = useMemo(
    () => tree.some((node) => node.type === "folder"),
    [tree]
  );

  const totalFolders = useMemo(() => {
    let count = 0;
    const countFolders = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.type === "folder") {
          count++;
          if (node.children) countFolders(node.children);
        }
      }
    };
    countFolders(tree);
    return count;
  }, [tree]);

  const totalFiles = objects.length;
  const isExpanded = expandedFolders.size > 0;

  return (
    <div className={cn("flex flex-col", className)}>
      {hasAnyFolders && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-muted-foreground text-[10px]">
                {totalFolders} {totalFolders === 1 ? "folder" : "folders"},{" "}
                {totalFiles} {totalFiles === 1 ? "file" : "files"}
              </div>
              <Breadcrumb
                path={selectedPath ?? null}
                onNavigate={handleBreadcrumbNavigate}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onPress={isExpanded ? collapseAll : expandAll}
              className="text-muted-foreground hover:text-foreground">
              <ChevronsUpDown className="size-3" />
              {isExpanded ? "Collapse" : "Expand"}
            </Button>
          </div>
          <Separator className="my-2" />
        </>
      )}

      <ScrollShadow className="max-h-[500px]">
        {tree.map((node) => (
          <TreeNodeComponent
            key={node.path}
            node={node}
            level={0}
            selectedPath={selectedPath ?? null}
            onSelect={handleSelect}
            expandedFolders={expandedFolders}
            onToggleFolder={handleToggleFolder}
          />
        ))}
      </ScrollShadow>
    </div>
  );
}
