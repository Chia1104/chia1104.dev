import dynamic from "next/dynamic";

export { MDXImage as Image } from "@chia/components/pages/posts/MDXComponents/MDXImage";
export { MDXLink as a } from "@chia/components/pages/posts/MDXComponents/MDXLink";
export {
  MDXCode as Code,
  MDXPre as pre,
  MDXCodeOrigin as code,
} from "@chia/components/pages/posts/MDXComponents/MDXCode";
export {
  h1,
  h2,
  h4,
  h3,
  h5,
  h6,
} from "@chia/components/pages/posts/MDXComponents/MDXHeading";
export {
  MDXOl as ol,
  MDXUl as ul,
} from "@chia/components/pages/posts/MDXComponents/MDXList";
export {
  MDXTable as table,
  MDXTh as th,
  MDXTd as td,
} from "@chia/components/pages/posts/MDXComponents/MDXTable";
export { MDXQuote as Quote } from "@chia/components/pages/posts/MDXComponents/MDXQuote";
export {
  MDXParagraph as p,
  MDXStrong as strong,
} from "@chia/components/pages/posts/MDXComponents/MDXText";
export {
  MDXDivider as Divider,
  MDXHr as hr,
} from "@chia/components/pages/posts/MDXComponents/MDXDivider";
export { MDXBr as br } from "@chia/components/pages/posts/MDXComponents/MDXBr";
export { MDXSpacer as Spacer } from "@chia/components/pages/posts/MDXComponents/MDXSpacer";

export const CodeSandBox = dynamic(
  () => import("../MDXComponents/MDXCodeSandBox")
);
export const Youtube = dynamic(() => import("../MDXComponents/MDXYoutube"));
