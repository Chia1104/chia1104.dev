"use client";

import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  useDisclosure,
  Input,
} from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import ky from "ky";
import { HTTPError } from "ky";
import { toast } from "sonner";
import * as z from "zod";

import { useFormRules } from "@chia/ui/utils/use-form-rules";

import { orpc } from "@/libs/orpc/client";

interface FilePart {
  id: string;
  name: string;
  type: string;
  path: string;
  isPending: boolean;
}

const UploadForm = ({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { patterns } = useFormRules();
  const upload = useMutation(orpc.file["signed-url:create"].mutationOptions());

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      const result = patterns.image.safeParse(file);
      if (!result.success) {
        errors.push(
          `${file.name}: ${z.treeifyError(result.error).errors.join(", ")}`
        );
      } else {
        validFiles.push(result.data);
      }
    }

    if (errors.length > 0) {
      toast.error(errors.join("\n"));
    }

    if (validFiles.length === 0) {
      return;
    }

    const newFiles: FilePart[] = [];

    for (const file of validFiles) {
      const fileId = crypto.randomUUID();
      newFiles.push({
        id: fileId,
        name: file.name,
        type: file.type,
        path: "",
        isPending: true,
      });
    }

    const uploadPromises = validFiles.map(async (file, index) => {
      if (!newFiles[index]) {
        return;
      }
      const sha256Checksum = await crypto.subtle.digest(
        "SHA-256",
        new Uint8Array(await file.arrayBuffer())
      );
      const sha256ChecksumHex = Array.from(new Uint8Array(sha256Checksum))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const sha256ChecksumBase64 = btoa(
        String.fromCharCode(...new Uint8Array(sha256Checksum))
      );

      try {
        const response = await upload.mutateAsync({
          key: file.name,
          area: "global",
          sha256Checksum: sha256ChecksumHex,
          type: file.type as
            | "image/jpeg"
            | "image/png"
            | "image/webp"
            | "image/heic"
            | "image/heif",
          size: file.size,
        });

        newFiles[index].path = response.url;

        await ky.put(response.url, {
          body: file,
          headers: {
            ChecksumSHA256: sha256ChecksumBase64,
            "Content-Type": file.type,
          },
        });

        newFiles[index].isPending = false;
      } catch (error) {
        if (error instanceof HTTPError) {
          console.error(await error.response.json());
        }
        newFiles[index].isPending = false;
        toast.error("Failed to upload file");
      }
    });

    await Promise.allSettled(uploadPromises);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>Upload File</ModalHeader>
        <ModalBody>
          <Input type="file" name="file" onChange={handleUploadImage} />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export const UploadModal = () => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  return (
    <>
      <UploadForm isOpen={isOpen} onOpenChange={onOpenChange} />
      <Button onPress={onOpen}>Upload File</Button>
    </>
  );
};
