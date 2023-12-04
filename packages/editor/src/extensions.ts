import { common, createLowlight } from "lowlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";

const lowlight = createLowlight(common);

export default [
  CodeBlockLowlight.configure({
    lowlight,
  }),
];
