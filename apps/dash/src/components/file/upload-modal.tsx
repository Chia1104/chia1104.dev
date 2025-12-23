"use client";

import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  useDisclosure,
  Input,
  Form,
} from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import ky from "ky";

import { orpc } from "@/libs/orpc/client";

const UploadForm = ({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const upload = useMutation(
    orpc.file["signed-url:create"].mutationOptions({
      onSuccess: (data) => {
        console.log(data);
      },
    })
  );

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const file = formData.get("file") as File;
    if (!file) {
      return;
    }
    const data = await upload.mutateAsync({
      key: `${file.name}-${crypto.randomUUID()}`,
    });

    await ky.put(data.url, {
      body: file,
    });
  };
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>Upload File</ModalHeader>
        <ModalBody>
          <Form onSubmit={onSubmit}>
            <Input type="file" name="file" />
            <Button type="submit">Upload</Button>
          </Form>
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
