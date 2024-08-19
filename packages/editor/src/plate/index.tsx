"use client";

import type { ComponentPropsWithoutRef } from "react";

import { createBasicElementsPlugin } from "@udecode/plate-basic-elements";
import { createPlugins, Plate } from "@udecode/plate-common";

import { Editor } from "./components/editor";
import type { EditorProps } from "./components/editor";

interface Props extends Partial<ComponentPropsWithoutRef<typeof Plate>> {
  editorProps?: EditorProps;
}

const plugins = createPlugins([createBasicElementsPlugin()], {
  components: {},
});

const initialValue = [
  {
    id: 1,
    type: "p",
    children: [{ text: "" }],
  },
];

export default function PlateEditor({ editorProps, ...props }: Props) {
  return (
    <Plate plugins={plugins} initialValue={initialValue} {...props}>
      <Editor
        placeholder="Type something..."
        focusRing={false}
        {...editorProps}
      />
    </Plate>
  );
}
