"use client";

import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  useDisclosure,
  Skeleton,
} from "@nextui-org/react";
import { useMutation } from "@tanstack/react-query";

import { ErrorBoundary } from "@chia/ui";

import { compile } from "@/server/mdx.action";

const Preview = ({ content }: { content: string }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [data, setData] = useState<ReactNode>(null);
  const { mutate, isPending, isError } = useMutation({
    mutationFn: async () => {
      return await compile(content);
    },
    onSuccess: (data) => {
      setData(data);
    },
  });

  const handleCompile = useCallback(() => {
    onOpen();
    mutate();
  }, [mutate, onOpen]);

  return (
    <>
      <Button variant="ghost" size="sm" onPress={handleCompile}>
        Preview<span className="text-xs">(Experimental Feature)</span>
      </Button>
      <Modal backdrop="blur" isOpen={isOpen} onClose={onClose} size="4xl">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 text-center text-xl w-full">
            Preview
          </ModalHeader>
          <ModalBody className="prose dark:prose-invert prose-img:m-0 min-w-full items-center">
            {isPending ? (
              <>
                <Skeleton className="h-[10px] min-w-full rounded-full" />
                <Skeleton className="h-[10px] min-w-full rounded-full" />
                <Skeleton className="h-[10px] min-w-full rounded-full" />
                <Skeleton className="h-[10px] min-w-full rounded-full" />
                <Skeleton className="h-[10px] min-w-full rounded-full" />
                <Skeleton className="h-[10px] min-w-full rounded-full" />
              </>
            ) : isError ? (
              <p>
                An error occurred while trying to preview the content. Please
                try again later.
              </p>
            ) : (
              <ErrorBoundary>{data}</ErrorBoundary>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

export default Preview;
