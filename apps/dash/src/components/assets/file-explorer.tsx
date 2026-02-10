"use client";

import { useState } from "react";

import { Card, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { FileImage } from "lucide-react";

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
    <Card>
      <UploadAssets />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {objects ? (
          <FileTree
            objects={objects}
            selectedPath={selectedPath}
            onSelect={handleSelect}
          />
        ) : (
          <Spinner />
        )}
        {isFileType(selectedPath, "image") && (
          <Card.Content>
            <Image.Root>
              <Image.Resource
                src={`https://storage.chia1104.dev/${selectedPath}`}
                alt="Selected File"
                className="h-full w-full object-contain"
              />
              <Image.Fallback className="flex h-full w-full items-center justify-center">
                <FileImage className="size-10 text-gray-500" />
              </Image.Fallback>
            </Image.Root>
          </Card.Content>
        )}
      </div>
    </Card>
  );
};
