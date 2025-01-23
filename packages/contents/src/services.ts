import { compileMDX as _compileMDX } from "@fumadocs/mdx-remote";
// import { remarkMermaid } from "@theguild/remark-mermaid";
import type { MDXComponents } from "mdx/types";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import type { Content } from "@chia/db/schema";
import { ContentType } from "@chia/db/types";

import { FumadocsComponents, V1MDXComponents } from "./mdx-components";
import type { ContentProps } from "./types";

type CompileResult = ReturnType<typeof _compileMDX>;

export const compileMDX: (
  content: string,
  components?: MDXComponents
) => CompileResult = (content: string, components?: MDXComponents) =>
  _compileMDX({
    source: content,
    components: {
      ...FumadocsComponents,
      ...V1MDXComponents,
      ...components,
    },
    mdxOptions: {
      remarkPlugins: [
        remarkMath,
        // remarkMermaid
      ],
      // Place it at first so that it won't be changed by syntax highlighter
      rehypePlugins: (v) => [rehypeKatex, ...v],
    },
  });

export const getContentProps = async ({
  contentType,
  content,
}: {
  contentType: ContentType;
  content: Partial<
    Pick<Content, "content" | "source" | "unstable_serializedSource">
  >;
}) => {
  switch (contentType) {
    case ContentType.Mdx: {
      const compiled = await compileMDX(content.content ?? "");
      return {
        type: ContentType.Mdx,
        toc: compiled.toc,
        content: compiled.body,
      } satisfies ContentProps;
    }
    default: {
      return {
        type: contentType,
        content: content.content,
      } satisfies ContentProps;
    }
  }
};
