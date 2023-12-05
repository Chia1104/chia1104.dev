"use client";

import {
  Button,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@nextui-org/react";
import {
  useRef,
  useState,
  type FC,
  type ComponentPropsWithoutRef,
} from "react";
import { useMonaco } from "@monaco-editor/react";
import { MDXStrong, useDarkMode } from "@chia/ui";
import MEditor from "@monaco-editor/react";

/**
 * @todo
 */
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

export const Monaco = () => {
  const { isDarkMode } = useDarkMode();
  const editorRef = useRef<ComponentPropsWithoutRef<typeof MEditor>>(null);
  const monaco = useMonaco();
  const [value, setValue] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <div className="relative w-full overflow-hidden rounded-2xl shadow-lg">
      <Button
        disabled
        className="absolute bottom-2 right-2 z-20"
        variant="flat"
        color="default">
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
        loading={<Spinner />}
        onChange={(value) => {
          setValue(value ?? "");
        }}
        value={value}
      />
    </div>
  );
};
