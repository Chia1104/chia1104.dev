"use client";

import { Button, Skeleton } from "@heroui/react";
import { Search } from "lucide-react";

import { FileTree } from "@chia/ui/file-tree";
import type { R2ObjectItem } from "@chia/ui/file-tree";

interface FileTreePanelProps {
  objects: R2ObjectItem[] | undefined;
  filteredObjects: R2ObjectItem[];
  selectedPath: string | null;
  search: string;
  onSelect: (path: string, type: "file" | "folder") => void;
  onClearSearch: () => void;
}

export const FileTreePanel = ({
  objects,
  filteredObjects,
  selectedPath,
  search,
  onSelect,
  onClearSearch,
}: FileTreePanelProps) => {
  if (!objects) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (filteredObjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Search className="text-muted-foreground size-8 opacity-30" />
        <div>
          <p className="text-foreground text-sm font-medium">No results</p>
          <p className="text-muted-foreground text-xs">
            No files match &ldquo;{search}&rdquo;
          </p>
        </div>
        <Button size="sm" variant="ghost" onPress={onClearSearch}>
          Clear search
        </Button>
      </div>
    );
  }

  return (
    <FileTree
      objects={filteredObjects}
      selectedPath={selectedPath}
      onSelect={onSelect}
      className="max-h-[65vh]"
    />
  );
};
