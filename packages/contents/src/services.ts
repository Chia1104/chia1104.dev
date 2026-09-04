import { createCompiler } from "@fumadocs/mdx-remote";
import { remarkDirectiveAdmonition } from "fumadocs-core/mdx-plugins";
import type { MDXComponents } from "mdx/types";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import { FumadocsComponents, V1MDXComponents } from "./mdx-components";
import type { GetContentPropsArgs, GetContentPropsReturn } from "./types";

const compiler = createCompiler({
  remarkPlugins: [remarkMath, remarkDirectiveAdmonition],
  rehypePlugins: (v) => [rehypeKatex, ...v],
});

export const compileMDX = (content: string, components?: MDXComponents) => {
  return compiler.compile({
    source: content,
    components: {
      ...FumadocsComponents,
      ...V1MDXComponents,
      ...components,
    },
  });
};

export const getContentProps = async ({
  content,
}: GetContentPropsArgs): GetContentPropsReturn => {
  const compiled = await compileMDX(content ?? "");
  return { toc: compiled.toc, content: compiled.body };
};
