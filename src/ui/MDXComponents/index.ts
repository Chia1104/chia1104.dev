"use client";

import dynamic from "next/dynamic";

export { MDXImage as Image } from "./MDXImage";
export { MDXImage as img } from "./MDXImage";
export {
  MDXCode as Code,
  MDXPre as pre,
  MDXCodeOrigin as code,
} from "./MDXCode";
export { h1, h2, h4, h3, h5, h6 } from "./MDXHeading";
export { MDXOl as ol, MDXUl as ul } from "./MDXList";
export {
  MDXTable as table,
  MDXTh as th,
  MDXTd as td,
  MDXTr as tr,
  MDXThead as thead,
  MDXTBody as tbody,
} from "./MDXTable";
export { MDXQuote as Quote } from "./MDXQuote";
export { MDXQuote as blockquote } from "./MDXQuote";
export { MDXParagraph as p, MDXStrong as strong } from "./MDXText";
export { MDXHr as hr } from "./MDXDivider";
export { MDXBr as br } from "./MDXBr";
export { MDXSpacer as Spacer } from "./MDXSpacer";
export { default as a } from "../Link";

export const CodeSandBox = dynamic(() => import("./MDXCodeSandBox"));
export const Youtube = dynamic(() => import("./MDXYoutube"));
