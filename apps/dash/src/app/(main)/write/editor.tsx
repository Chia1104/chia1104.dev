"use client";

import dynamic from "next/dynamic";
import { useDarkMode } from "@/hooks";
import { Button } from "@nextui-org/react";
import { useRef } from "react";
import { useMonaco } from "@monaco-editor/react";

const MEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

const Editor = () => {
  const { isDarkMode } = useDarkMode();
  const editorRef = useRef<any>(null);
  const monaco = useMonaco();
  return (
    <div className="relative w-full overflow-hidden rounded-xl shadow-lg">
      <Button
        className="absolute bottom-2 right-2 z-20"
        variant="flat"
        color="neutral"
        onPress={() => {
          console.log(editorRef, monaco);
        }}>
        Format
      </Button>
      <MEditor
        height="85vh"
        defaultLanguage="markdown"
        theme={isDarkMode ? "vs-dark" : "light"}
        onMount={(editor) => {
          editorRef.current = editor;
        }}
      />
    </div>
  );
};

export default Editor;
