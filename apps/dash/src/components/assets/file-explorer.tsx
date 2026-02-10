"use client";

import { useState } from "react";

import { Card, Spinner, Skeleton, Chip } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import { CopyButton } from "@chia/ui/copy-button";
import { FileTree } from "@chia/ui/file-tree";
import { isFileType } from "@chia/ui/file-tree";
import { Image } from "@chiastack/ui/image";

import { orpc } from "@/libs/orpc/client";

import { UploadAssets } from "./upload-assets";

export const FileExplorer = () => {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const { data: objects } = useQuery(
    orpc.file.list.queryOptions({
      input: {},
    })
  );

  const handleSelect = (path: string) => {
    setSelectedPath(path);
  };

  return (
    <Card className="max-h-[80vh]">
      <UploadAssets />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex-1">
          {objects ? (
            <FileTree
              objects={objects}
              selectedPath={selectedPath}
              onSelect={handleSelect}
              className="max-h-[70vh]"
            />
          ) : (
            <Spinner />
          )}
        </div>
        {isFileType(selectedPath, "image") && (
          <Card.Content className="flex flex-col gap-4">
            <Card.Title>{selectedPath}</Card.Title>
            <Chip className="max-w-70">
              <Chip.Label className="line-clamp-1">
                https://storage.chia1104.dev/{selectedPath}
              </Chip.Label>
              <CopyButton
                content={`https://storage.chia1104.dev/${selectedPath}`}
                size="sm"
                variant="secondary"
                translations={{
                  copied: "Copied",
                  copy: "Copy",
                }}
              />
            </Chip>
            <div className="relative aspect-square h-[80%] w-[80%] overflow-hidden rounded-lg border">
              <Image.Root>
                <Image.Resource
                  src={`https://storage.chia1104.dev/${selectedPath}`}
                  alt="Selected File"
                  className="h-full w-full object-contain"
                />
                <Image.FallbackActivity>
                  <Skeleton className="h-full w-full" />
                </Image.FallbackActivity>
              </Image.Root>
            </div>
          </Card.Content>
        )}
      </div>
    </Card>
  );
};
