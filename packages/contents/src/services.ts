import { createCompiler } from "@fumadocs/mdx-remote";
import { remarkDirectiveAdmonition } from "fumadocs-core/mdx-plugins";
import { rehypeCodeDefaultOptions } from "fumadocs-core/mdx-plugins";
import { transformerTwoslash } from "fumadocs-twoslash";
import type { MDXComponents } from "mdx/types";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import { ContentType } from "@chia/db/types";

import { FumadocsComponents, V1MDXComponents } from "./mdx-components";
import type { GetContentPropsArgs, GetContentPropsReturn } from "./types";

const compiler = createCompiler({
  remarkPlugins: [remarkMath, remarkDirectiveAdmonition],
  rehypePlugins: (v) => [rehypeKatex, ...v],
  rehypeCodeOptions: {
    themes: {
      light: "github-light",
      dark: "github-dark",
    },
    transformers: [
      ...(rehypeCodeDefaultOptions.transformers ?? []),
      transformerTwoslash(),
    ],
    // important: Shiki doesn't support lazy loading languages for codeblocks in Twoslash popups
    // make sure to define them first (e.g. the common ones)
    langs: ["js", "jsx", "ts", "tsx"],
  },
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
      const compiled = await compileMDX(content.content ?? "");
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
