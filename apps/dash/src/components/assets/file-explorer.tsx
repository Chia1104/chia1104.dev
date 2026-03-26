"use client";

import { useState, useCallback, useMemo } from "react";

import { Card, Button } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Info } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/libs/orpc/client";

import { DeleteConfirmModal } from "./delete-confirm-modal";
import { ExplorerToolbar } from "./explorer-toolbar";
import { FileDetailPanel } from "./file-detail-panel";
import { FileTreeDrawer } from "./file-tree-drawer";
import { FileTreePanel } from "./file-tree-panel";
import { STORAGE_BASE_URL } from "./utils";

export const FileExplorer = () => {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"file" | "folder" | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: objects } = useQuery(
    orpc.file.list.queryOptions({ input: {} })
  );

  const filteredObjects = useMemo(() => {
    if (!objects) return [];
    if (!search.trim()) return objects;
    const lower = search.toLowerCase();
    return objects.filter((obj) => obj.key.toLowerCase().includes(lower));
  }, [objects, search]);

  const selectedObject = useMemo(
    () => objects?.find((obj) => obj.key === selectedPath),
    [objects, selectedPath]
  );

  const deleteMutation = useMutation(
    orpc.file.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.file.list.queryKey({ input: {} }),
        });
        toast.success("File deleted successfully");
        setSelectedPath(null);
        setDeleteTarget(null);
      },
      onError: () => {
        toast.error("Failed to delete file");
        setDeleteTarget(null);
      },
    })
  );

  const handleSelect = useCallback((path: string, type: "file" | "folder") => {
    setSelectedPath(path);
    setSelectedType(type);
    if (type === "file") {
      setIsDrawerOpen(false);
    }
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate({ key: deleteTarget });
  }, [deleteTarget, deleteMutation]);

  const fileName = selectedPath?.split("/").pop() ?? "";
  const fileUrl = selectedPath ? `${STORAGE_BASE_URL}/${selectedPath}` : "";
  const deleteTargetName = deleteTarget?.split("/").pop() ?? "";

  return (
    <>
      <Card className="max-h-[80vh] overflow-hidden">
        <Card.Content className="flex flex-col gap-4 overflow-y-auto p-4">
          <ExplorerToolbar
            search={search}
            onSearchChange={setSearch}
            onBrowse={() => setIsDrawerOpen(true)}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="hidden min-w-0 md:block">
              <FileTreePanel
                objects={objects}
                filteredObjects={filteredObjects}
                selectedPath={selectedPath}
                search={search}
                onSelect={handleSelect}
                onClearSearch={() => setSearch("")}
              />
            </div>

            {selectedPath && selectedType === "file" ? (
              <FileDetailPanel
                selectedPath={selectedPath}
                fileUrl={fileUrl}
                fileName={fileName}
                fileSize={selectedObject?.size}
                onDelete={() => setDeleteTarget(selectedPath)}
              />
            ) : (
              <>
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center md:hidden">
                  <FolderOpen className="text-muted-foreground size-10 opacity-30" />
                  <p className="text-muted-foreground text-sm">
                    Tap Browse to explore your files
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => setIsDrawerOpen(true)}>
                    Browse Files
                  </Button>
                </div>
                {objects && objects.length > 0 && (
                  <div className="hidden items-center justify-center md:flex">
                    <div className="text-muted-foreground flex flex-col items-center gap-2 opacity-30">
                      <Info className="size-10" />
                      <p className="text-sm">Select a file to view details</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card.Content>
      </Card>

      <FileTreeDrawer
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        search={search}
        onSearchChange={setSearch}>
        <FileTreePanel
          objects={objects}
          filteredObjects={filteredObjects}
          selectedPath={selectedPath}
          search={search}
          onSelect={handleSelect}
          onClearSearch={() => setSearch("")}
        />
      </FileTreeDrawer>

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        isPending={deleteMutation.isPending}
        targetName={deleteTargetName}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
};
