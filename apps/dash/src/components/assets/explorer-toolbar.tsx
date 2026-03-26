"use client";

import { Button, Input, TextField } from "@heroui/react";
import { FolderOpen, Search } from "lucide-react";

import { UploadAssets } from "./upload-assets";

interface ExplorerToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onBrowse: () => void;
}

export const ExplorerToolbar = ({
  search,
  onSearchChange,
  onBrowse,
}: ExplorerToolbarProps) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <UploadAssets />
      <Button
        size="sm"
        variant="secondary"
        className="md:hidden"
        onPress={onBrowse}>
        <FolderOpen className="size-4" />
        Browse
      </Button>
      <TextField
        aria-label="Search files"
        value={search}
        onChange={onSearchChange}
        className="relative hidden min-w-0 flex-1 md:block">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2" />
          <Input placeholder="Search files..." className="pl-8" />
        </div>
      </TextField>
    </div>
  );
};
