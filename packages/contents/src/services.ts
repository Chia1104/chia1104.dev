import { cache } from "react";

import { compileMDX as _compileMDX } from "@fumadocs/mdx-remote";
import type { MDXComponents } from "mdx/types";

import type { Content } from "@chia/db/schema";
import { ContentType } from "@chia/db/types";

import { FumadocsComponents, V1MDXComponents } from "./mdx-components";
import type { ContentProps } from "./types";

type CompileResult = ReturnType<typeof _compileMDX>;

export const compileMDX: (
  content: string,
  components?: MDXComponents
) => CompileResult = cache(
  async (content: string, components?: MDXComponents) => {
    return await _compileMDX({
      source: content,
      components: {
        ...FumadocsComponents,
        ...V1MDXComponents,
        ...components,
      },
    });
  }
);

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
        content: compiled.content,
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
