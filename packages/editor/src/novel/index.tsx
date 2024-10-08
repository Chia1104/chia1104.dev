"use client";

import React, { useState } from "react";
import type { FC, ComponentPropsWithoutRef } from "react";

import {
  EditorRoot,
  EditorContent,
  EditorBubble,
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
} from "novel";

import { cn } from "@chia/ui";

import extensions, { suggestionItems } from "./extensions";
import { NodeSelector } from "./selectors";

const Novel: FC<
  Omit<
    ComponentPropsWithoutRef<typeof EditorContent>,
    "children" | "extensions"
  >
> = ({ className, editorProps, ...props }) => {
  const [openNodeSelector, setOpenNodeSelector] = useState(false);
  return (
    <EditorRoot>
      <EditorContent
        {...props}
        editorProps={{
          attributes: {
            class: `prose dark:prose-invert focus:outline-none min-h-[300px] min-w-full`,
            ...editorProps?.attributes,
          },
          ...editorProps,
        }}
        className={cn(
          "c-bg-third m-0 min-w-full overflow-hidden rounded-2xl border border-gray-300 p-7 shadow-lg transition-all ease-in-out dark:border-gray-700",
          className
        )}
        extensions={extensions}>
        <EditorBubble>
          <NodeSelector
            open={openNodeSelector}
            onOpenChange={setOpenNodeSelector}
          />
        </EditorBubble>
        <EditorCommand className="border-muted c-bg-third z-50  h-auto max-h-[330px] w-72 overflow-y-auto rounded-md border px-1 py-2 shadow-md transition-all">
          <EditorCommandEmpty className="text-muted-foreground px-2">
            No results
          </EditorCommandEmpty>
          {suggestionItems.map((item) => (
            <EditorCommandItem
              value={item.title}
              onCommand={(val) => item?.command?.(val)}
              className={`hover:bg-default/40 aria-selected:bg-default/40 flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-sm `}
              key={item.title}>
              <div className="border-muted bg-default flex h-10 w-10 items-center justify-center rounded-md border">
                {item.icon}
              </div>
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-muted-foreground text-xs">
                  {item.description}
                </p>
              </div>
            </EditorCommandItem>
          ))}
        </EditorCommand>
      </EditorContent>
    </EditorRoot>
  );
};

export default Novel;
