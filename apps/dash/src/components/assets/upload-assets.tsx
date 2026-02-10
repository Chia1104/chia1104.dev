"use client";

import { useCallback, useMemo, useState, useRef } from "react";

import { Button } from "@heroui/react";
import { Modal } from "@heroui/react";
import { Spinner } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ky from "ky";
import { HTTPError } from "ky";
import { Upload, X, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as z from "zod";

import { Progress } from "@chia/ui/progress";
import { cn } from "@chia/ui/utils/cn.util";
import { useFormRules } from "@chia/ui/utils/use-form-rules";

import { orpc } from "@/libs/orpc/client";

interface FileUploadItem {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
  url?: string;
}

interface UploadAssetsProps {
  area?: "global" | "feed";
  onUploadComplete?: (files: FileUploadItem[]) => void;
}

const calculateSHA256Checksum = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  return await crypto.subtle.digest("SHA-256", arrayBuffer);
};

const sha256ChecksumToHex = (checksum: ArrayBuffer): string => {
  const hashArray = Array.from(new Uint8Array(checksum));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

const sha256ChecksumToBase64 = (checksum: ArrayBuffer): string => {
  return btoa(
    Array.from(new Uint8Array(checksum))
      .map((byte) => String.fromCharCode(byte))
      .join("")
  );
};

export function UploadAssets({
  area = "global",
  onUploadComplete,
}: UploadAssetsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { patterns } = useFormRules();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadItems, setUploadItems] = useState<FileUploadItem[]>([]);
  const queryClient = useQueryClient();

  const createSignedUrlMutation = useMutation(
    orpc.file["signed-url:create"].mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.file.list.queryKey({
            input: {},
          }),
        });
      },
    })
  );

  const validateFiles = useCallback(
    (files: FileList | null): File[] => {
      if (!files || files.length === 0) {
        return [];
      }

      const validFiles: File[] = [];
      const errors: string[] = [];

      for (const file of Array.from(files)) {
        const result = patterns.image.safeParse(file);
        if (!result.success) {
          const treeified = z.treeifyError(result.error);
          const errorMessages = treeified.errors.map(
            (e) => (e as { message?: string }).message || String(e)
          );
          errors.push(`${file.name}: ${errorMessages.join(", ")}`);
        } else {
          validFiles.push(result.data);
        }
      }

      if (errors.length > 0) {
        toast.error(`File validation failed:\n${errors.join("\n")}`);
      }

      return validFiles;
    },
    [patterns.image]
  );

  const uploadSingleFile = useCallback(
    async (item: FileUploadItem): Promise<void> => {
      setUploadItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: "uploading", progress: 0 } : i
        )
      );

      try {
        const sha256Checksum = await calculateSHA256Checksum(item.file);
        const sha256Hex = sha256ChecksumToHex(sha256Checksum);
        const sha256Base64 = sha256ChecksumToBase64(sha256Checksum);

        const response = await createSignedUrlMutation.mutateAsync({
          key: item.name,
          area,
          sha256Checksum: sha256Hex,
          type: item.type as
            | "image/jpeg"
            | "image/png"
            | "image/webp"
            | "image/heic"
            | "image/heif",
          size: item.size,
        });

        setUploadItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, progress: 50 } : i))
        );

        await ky.put(response.url, {
          body: item.file,
          headers: {
            ChecksumSHA256: sha256Base64,
            "Content-Type": item.type,
          },
          onUploadProgress: (progress) => {
            setUploadItems((prev) =>
              prev.map((i) =>
                i.id === item.id ? { ...i, progress: progress.percent } : i
              )
            );
          },
        });

        setUploadItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: "success",
                  progress: 100,
                  url: response.url.split("?")[0],
                }
              : i
          )
        );

        toast.success(`Successfully uploaded: ${item.name}`);
      } catch (error) {
        let errorMessage = "Upload failed, please try again later";
        if (error instanceof HTTPError) {
          const statusText =
            error.response.statusText || `HTTP ${error.response.status}`;
          errorMessage = `Upload failed: ${statusText}`;
        } else if (error instanceof Error) {
          errorMessage = `Upload failed: ${error.message}`;
        }

        setUploadItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: "error",
                  error: errorMessage,
                  progress: 0,
                }
              : i
          )
        );

        toast.error(`${item.name}: ${errorMessage}`);

        if (error instanceof HTTPError) {
          console.error(
            "Upload error:",
            await error.response.json().catch(() => ({}))
          );
        }
      }
    },
    [area, createSignedUrlMutation]
  );

  const handleUpload = useCallback(
    async (items: FileUploadItem[]) => {
      const uploadPromises = items.map((item) => uploadSingleFile(item));
      await Promise.allSettled(uploadPromises);

      setUploadItems((prev) => {
        const allComplete = prev.every(
          (i) => i.status === "success" || i.status === "error"
        );
        if (allComplete && onUploadComplete) {
          onUploadComplete(prev);
        }
        return prev;
      });
    },
    [uploadSingleFile, onUploadComplete]
  );

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) {
        return;
      }

      const validFiles = validateFiles(fileArray as unknown as FileList);
      if (validFiles.length === 0) {
        return;
      }

      const newItems: FileUploadItem[] = validFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        type: file.type,
        size: file.size,
        status: "pending",
        progress: 0,
      }));

      setUploadItems((prev) => [...prev, ...newItems]);

      void handleUpload(newItems);
    },
    [validateFiles, handleUpload]
  );

  const handleFileSelectWithUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) {
        return;
      }
      processFiles(files);
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processFiles(files);
      }
    },
    [processFiles]
  );

  const handleRemove = useCallback((id: string) => {
    setUploadItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleClear = useCallback(() => {
    setUploadItems([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleClose = useCallback(() => {
    handleClear();
    setIsOpen(false);
  }, [handleClear]);

  const stats = useMemo(() => {
    const total = uploadItems.length;
    const success = uploadItems.filter((i) => i.status === "success").length;
    const error = uploadItems.filter((i) => i.status === "error").length;
    const uploading = uploadItems.filter(
      (i) => i.status === "uploading"
    ).length;
    const pending = uploadItems.filter((i) => i.status === "pending").length;

    return { total, success, error, uploading, pending };
  }, [uploadItems]);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }, []);

  const getStatusIcon = useCallback((status: FileUploadItem["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="text-success size-4" />;
      case "error":
        return <AlertCircle className="text-danger size-4" />;
      case "uploading":
        return <Spinner size="sm" />;
      default:
        return null;
    }
  }, []);

  return (
    <>
      <Button onPress={() => setIsOpen(true)}>
        <Upload className="size-4" />
        Upload Files
      </Button>

      <Modal>
        <Modal.Backdrop isOpen={isOpen} onOpenChange={handleClose}>
          <Modal.Container placement="auto">
            <Modal.Dialog className="sm:max-w-2xl">
              <Modal.CloseTrigger />
              <Modal.Header>
                <div className="flex w-full items-center justify-between">
                  <Modal.Heading>Upload Files</Modal.Heading>
                  {stats.total > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={handleClear}
                      className="text-muted-foreground">
                      Clear All
                    </Button>
                  )}
                </div>
              </Modal.Header>

              <Modal.Body>
                <div className="flex flex-col gap-4">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      "border-border rounded-lg border-2 border-dashed p-6 transition-colors",
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    )}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                      onChange={handleFileSelectWithUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="flex cursor-pointer flex-col items-center justify-center gap-2">
                      <Upload
                        className={cn(
                          "size-8 transition-colors",
                          isDragging ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <div className="text-center">
                        <p
                          className={cn(
                            "text-sm font-medium transition-colors",
                            isDragging && "text-primary"
                          )}>
                          {isDragging
                            ? "Drop files here to upload"
                            : "Click or drag files here to upload"}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Supports JPEG, PNG, WebP, HEIC, HEIF (max 10MB)
                        </p>
                      </div>
                    </label>
                  </div>

                  {stats.total > 0 && (
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Total: {stats.total}
                      </span>
                      {stats.success > 0 && (
                        <span className="text-success">
                          Success: {stats.success}
                        </span>
                      )}
                      {stats.error > 0 && (
                        <span className="text-danger">
                          Failed: {stats.error}
                        </span>
                      )}
                      {(stats.uploading > 0 || stats.pending > 0) && (
                        <span className="text-muted-foreground">
                          Uploading: {stats.uploading + stats.pending}
                        </span>
                      )}
                    </div>
                  )}

                  {uploadItems.length > 0 && (
                    <div className="space-y-2">
                      {uploadItems.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "border-border rounded-lg border p-3",
                            item.status === "error" &&
                              "border-danger/50 bg-danger/5"
                          )}>
                          <div className="flex items-center gap-3">
                            <div className="shrink-0">
                              {getStatusIcon(item.status)}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-medium">
                                  {item.name}
                                </p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  isIconOnly
                                  onPress={() => handleRemove(item.id)}
                                  className="shrink-0">
                                  <X className="size-4" />
                                </Button>
                              </div>
                              <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                                <span>{formatFileSize(item.size)}</span>
                                {item.status === "uploading" && (
                                  <span>• {item.progress}%</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {item.status === "uploading" && (
                            <div className="mt-2">
                              <Progress value={item.progress} />
                            </div>
                          )}

                          {item.status === "error" && item.error && (
                            <p className="text-danger mt-2 text-xs">
                              {item.error}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Modal.Body>

              <Modal.Footer>
                <Button variant="ghost" slot="close">
                  Close
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
