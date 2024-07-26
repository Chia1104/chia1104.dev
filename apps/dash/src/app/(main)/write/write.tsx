"use client";

import type { FC } from "react";

import { Tabs, Tab, Button } from "@nextui-org/react";
import dynamic from "next/dynamic";

import NovelEditor from "@chia/editor/editor";
import { cn } from "@chia/ui";

import { WriteProvider, useWriteContext } from "./write.context";

const LoadingFallback: FC<{ className?: string }> = ({ className }) => (
  <div
    className={cn("c-bg-third min-h-[85vh] w-full rounded-2xl", className)}
  />
);

const MonacoEditor = dynamic(
  () => import("./editor").then((mod) => mod.Monaco),
  {
    ssr: false,
    loading: () => <LoadingFallback />,
  }
);

const SwitchEditor: FC<{ className?: string }> = ({ className }) => {
  const { state, setState } = useWriteContext();
  return (
    <Tabs
      className={cn(className)}
      size="sm"
      selectedKey={state?.editorType}
      onSelectionChange={(value) => {
        setState({
          ...state,
          // @ts-expect-error - are we cool?
          editorType: value,
        });
      }}>
      <Tab key="novel" title="Novel" />
      <Tab key="monaco" title="Monaco" />
    </Tabs>
  );
};

const Editor = () => {
  const { state, setState } = useWriteContext();

  if (state?.editorType === "novel") {
    return (
      <div className="relative w-full">
        <NovelEditor
          className="z-10 min-h-[85vh]"
          onUpdate={({ editor }) => {
            setState({
              ...state,
              content: editor?.getHTML(),
            });
          }}
        />
      </div>
    );
  }

  return <MonacoEditor />;
};

const Write = () => {
  const { state } = useWriteContext();
  return (
    <div className="relative flex w-full max-w-[800px] flex-col items-center justify-center gap-3">
      <SwitchEditor className="absolute right-1 top-1 z-20" />
      <Editor />
      <Button
        isDisabled={state?.editorType === "monaco"}
        className="mt-5 self-end"
        color="primary"
        variant="ghost"
        onPress={() => console.log(state?.content)}>
        Submit
      </Button>
    </div>
  );
};

const Index = () => (
  <WriteProvider>
    <Write />
  </WriteProvider>
);

export default Index;
