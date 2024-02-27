import { generateHTML as interneal_generateHTML } from "@tiptap/html";
import type { JSONContent } from "@tiptap/core";
import extensions from "./extensions";

export const generateHTML = (content: JSONContent) => {
  return interneal_generateHTML(content, extensions);
};
