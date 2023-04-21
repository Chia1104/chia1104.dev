"use client";

import dynamic from "next/dynamic";

export { MDXImage as Image } from "ui";
export { MDXImage as img } from "ui";
export { MDXCode as Code, MDXPre as pre, MDXCodeOrigin as code } from "ui";
export { h1, h2, h4, h3, h5, h6 } from "ui";
export { MDXOl as ol, MDXUl as ul } from "ui";
export {
  MDXTable as table,
  MDXTh as th,
  MDXTd as td,
  MDXTr as tr,
  MDXThead as thead,
  MDXTBody as tbody,
} from "ui";
export { MDXQuote as Quote } from "ui";
export { MDXQuote as blockquote } from "ui";
export { MDXParagraph as p, MDXStrong as strong } from "ui";
export { MDXHr as hr } from "ui";
export { MDXBr as br } from "ui";
export { MDXSpacer as Spacer } from "ui";
export { Link as a } from "ui";

export const CodeSandBox = dynamic(() =>
  import("ui").then((mod) => mod.MDXCodeSandBox)
);
export const Youtube = dynamic(() =>
  import("ui").then((mod) => mod.MDXYoutube)
);
