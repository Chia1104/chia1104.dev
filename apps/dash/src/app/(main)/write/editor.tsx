"use client";

import dynamic from "next/dynamic";
import { useDarkMode } from "@/hooks";
import {
  Button,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@nextui-org/react";
import { useRef, useState, type FC } from "react";
import { useMonaco } from "@monaco-editor/react";
import { MDXStrong } from "ui";

const MEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

const ComponentModal: FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <ModalContent>
        <ModalHeader>Modal Title</ModalHeader>
        <ModalBody>
          <p>Strong</p>
          <MDXStrong>Strong</MDXStrong>
        </ModalBody>
        <ModalFooter>
          <Button onPress={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const Editor = () => {
  const { isDarkMode } = useDarkMode();
  const editorRef = useRef<any>(null);
  const monaco = useMonaco();
  const [value, setValue] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <div className="relative w-full overflow-hidden rounded-xl shadow-lg">
      <Button
        className="absolute bottom-2 right-2 z-20"
        variant="flat"
        color="neutral"
        onPress={() => {
          editorRef.current?.getAction("editor.action.formatDocument").run();
        }}>
        Format
      </Button>
      <Button
        className="absolute bottom-2 right-24 z-20"
        variant="light"
        color="primary"
        onPress={() => {
          setIsModalOpen(true);
        }}>
        +
      </Button>
      <ComponentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <MEditor
        height="85vh"
        defaultLanguage="markdown"
        theme={isDarkMode ? "vs-dark" : "light"}
        onMount={(editor) => {
          editorRef.current = editor;
        }}
        loading={<Spinner />}
        onChange={(value) => {
          setValue(value ?? "");
        }}
        value={value}
      />
    </div>
  );
};

export default Editor;
