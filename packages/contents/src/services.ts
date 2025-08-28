import { createCompiler } from "@fumadocs/mdx-remote";
import { remarkAdmonition } from "fumadocs-core/mdx-plugins";
import type { MDXComponents } from "mdx/types";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import { ContentType } from "@chia/db/types";

import { FumadocsComponents, V1MDXComponents } from "./mdx-components";
import type { GetContentPropsArgs, GetContentPropsReturn } from "./types";

const compiler = createCompiler({
  remarkPlugins: [remarkMath, remarkAdmonition],
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
  contentType,
  content,
}: GetContentPropsArgs): GetContentPropsReturn => {
  switch (contentType) {
    case ContentType.Mdx: {
      if (content.content == null) {
        throw new Error("Content must have a content property");
      }
      const compiled = await compileMDX(content.content);
      return {
        type: ContentType.Mdx,
        toc: compiled.toc,
        content: compiled.body,
      };
    }
    default: {
      return {
        type: contentType,
        content: content.content,
      };
    }
  }
};
