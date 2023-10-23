"use client";

import dynamic from "next/dynamic";

export { MDXImage as Image } from "@chia/ui";
export { MDXImage as img } from "@chia/ui";
export {
  MDXCode as Code,
  MDXPre as pre,
  MDXCodeOrigin as code,
} from "@chia/ui";
export { h1, h2, h4, h3, h5, h6 } from "@chia/ui";
export { MDXOl as ol, MDXUl as ul } from "@chia/ui";
export {
  MDXTable as table,
  MDXTh as th,
  MDXTd as td,
  MDXTr as tr,
  MDXThead as thead,
  MDXTBody as tbody,
} from "@chia/ui";
export { MDXQuote as Quote } from "@chia/ui";
export { MDXQuote as blockquote } from "@chia/ui";
export { MDXParagraph as p, MDXStrong as strong } from "@chia/ui";
export { MDXHr as hr } from "@chia/ui";
export { MDXBr as br } from "@chia/ui";
export { MDXSpacer as Spacer } from "@chia/ui";
export { Link as a } from "@chia/ui";

export const CodeSandBox = dynamic(() =>
  import("@chia/ui").then((mod) => mod.MDXCodeSandBox)
);
export const Youtube = dynamic(() =>
  import("@chia/ui").then((mod) => mod.MDXYoutube)
);
