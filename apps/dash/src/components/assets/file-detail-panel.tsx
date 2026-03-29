"use client";

import { ViewTransition } from "react";

import { Button, Chip, Skeleton } from "@heroui/react";
import { File, FileImage, FileVideo, Trash2 } from "lucide-react";

import { CopyButton } from "@chia/ui/copy-button";
import { isFileType } from "@chia/ui/file-tree";
import { VideoPlayer } from "@chia/ui/video-player";
import { Image } from "@chiastack/ui/image";

import { formatBytes, getFileExtension } from "./utils";

interface FileDetailPanelProps {
  selectedPath: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | undefined;
  onDelete: () => void;
}

function FileTypeIcon({ path }: { path: string }) {
  if (isFileType(path, "image"))
    return <FileImage className="text-muted-foreground size-4 shrink-0" />;
  if (isFileType(path, "video"))
    return <FileVideo className="text-muted-foreground size-4 shrink-0" />;
  return <File className="text-muted-foreground size-4 shrink-0" />;
}

export const FileDetailPanel = ({
  selectedPath,
  fileUrl,
  fileName,
  fileSize,
  onDelete,
}: FileDetailPanelProps) => {
  return (
    <div className="border-border flex flex-col gap-4 border-t pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FileTypeIcon path={selectedPath} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{fileName}</p>
            <p className="text-muted-foreground truncate text-xs">
              {selectedPath}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          onPress={onDelete}
          className="text-danger shrink-0">
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Metadata chips */}
      <div className="flex flex-wrap gap-2">
        <Chip size="sm" variant="soft" className="line-clamp-1 max-w-20">
          {getFileExtension(fileName)}
        </Chip>
        {fileSize !== undefined && (
          <Chip size="sm" variant="soft" className="line-clamp-1">
            {formatBytes(fileSize)}
          </Chip>
        )}
      </div>

      {/* URL row */}
      <Chip className="max-w-fit">
        <Chip.Label className="line-clamp-1 text-xs">{fileUrl}</Chip.Label>
        <CopyButton
          content={fileUrl}
          size="sm"
          variant="secondary"
          translations={{
            copied: "Copied",
            copy: "Copy",
          }}
        />
      </Chip>

      {/* Image preview */}
      {isFileType(selectedPath, "image") && (
        <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-lg border">
          <Image.Root>
            <ViewTransition>
              <Image.Resource
                src={fileUrl}
                alt={fileName}
                className="absolute inset-0 h-full w-full object-contain"
              />
            </ViewTransition>
            <ViewTransition>
              <Image.FallbackActivity>
                <Skeleton className="absolute inset-0 h-full w-full" />
              </Image.FallbackActivity>
            </ViewTransition>
          </Image.Root>
        </div>
      )}

      {/* Video preview */}
      {isFileType(selectedPath, "video") && (
        <VideoPlayer src={fileUrl} className="aspect-video w-full max-w-xl" />
      )}
    </div>
  );
};
