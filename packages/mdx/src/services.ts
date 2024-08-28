import { cache } from "react";

import { compileMDX as _compileMDX } from "@fumadocs/mdx-remote";

import type { schema } from "@chia/db";
import { ContentType } from "@chia/db/types";

import { FumadocsComponents, V1MDXComponents } from "./mdx-components";
import type { ContentProps } from "./types";

export const compileMDX = cache(async (content: string) => {
  return _compileMDX({
    source: content,
    components: {
      ...FumadocsComponents,
      ...V1MDXComponents,
    },
  });
});

export const getContentProps = async ({
  contentType,
  content,
}: {
  contentType: ContentType;
  content: Partial<
    Pick<schema.Content, "content" | "source" | "unstable_serializedSource">
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
