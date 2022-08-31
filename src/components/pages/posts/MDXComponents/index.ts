import dynamic from "next/dynamic";

export { MDXImage as Image } from "./MDXImage";
export { MDXLink as a } from "./MDXLink";
export {
  MDXCode as Code,
  MDXPre as pre,
  MDXCodeOrigin as code,
} from "./MDXCode";
export { h1, h2, h4, h3, h5, h6 } from "./MDXHeading";
export { MDXOl as ol, MDXUl as ul } from "./MDXList";
export { MDXTable as table, MDXTh as th, MDXTd as td } from "./MDXTable";
export { MDXQuote as Quote } from "./MDXQuote";
export { MDXParagraph as p, MDXStrong as strong } from "./MDXText";
export { MDXHr as hr } from "./MDXDivider";
export { MDXBr as br } from "./MDXBr";
export { MDXSpacer as Spacer } from "./MDXSpacer";

export const CodeSandBox = dynamic(
  () => import("../MDXComponents/MDXCodeSandBox")
);
export const Youtube = dynamic(() => import("../MDXComponents/MDXYoutube"));
