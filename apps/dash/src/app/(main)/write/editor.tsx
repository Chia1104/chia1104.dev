"use client";

import { useState, useTransition } from "react";
import type { FC } from "react";

import MEditor from "@monaco-editor/react";
import {
  Button,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@nextui-org/react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { useTheme } from "@chia/ui";

import { compile } from "@/server/mdx.action";

import { useWriteContext } from "./write.context";

const PreviewModal: FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { state } = useWriteContext();
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onClose}
      scrollBehavior="inside"
      size="2xl">
      <ModalContent>
        <ModalHeader>Preview</ModalHeader>
        <ModalBody className="prose dark:prose-invert">
          {state?.serializedContent}
        </ModalBody>
        <ModalFooter>
          <Button onPress={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export const Monaco = () => {
  const { isDarkMode } = useTheme();
  const [value, setValue] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { setState, state } = useWriteContext();
  const [isPending, startTransition] = useTransition();
  const session = useSession();
  return (
    <div className="relative w-full overflow-hidden rounded-2xl shadow-lg">
      <Button
        isDisabled
        className="absolute bottom-2 right-2 z-20"
        variant="flat"
        color="default">
        Format
      </Button>
      <Button
        isLoading={isPending}
        className="absolute bottom-2 right-24 z-20"
        variant="light"
        color="primary"
        /**
         * @todo avoid script(code) injection
         */
        onPress={() =>
          startTransition(async () => {
            try {
              if (session.data?.user.role !== "admin") {
                toast.error("You don't have permission to preview.");
                return;
              }
              const serializedContent = await compile(value);
              setIsModalOpen(true);
              setState({
                ...state,
                feedType: "post",
                editorType: "monaco",
                serializedContent,
              });
            } catch (error) {
              console.error(error);
              toast.error("An error occurred while compiling the markdown.");
            }
          })
        }>
        Preview
      </Button>
      <PreviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <MEditor
        height="85vh"
        defaultLanguage="markdown"
        theme={isDarkMode ? "vs-dark" : "light"}
        loading={<Spinner />}
        onChange={(value) => {
          setValue(value ?? "");
          setState({
            ...state,
            feedType: "post",
            editorType: "monaco",
            sourceContent: value,
          });
        }}
        value={value}
      />
    </div>
  );
};
