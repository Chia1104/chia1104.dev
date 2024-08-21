import { cache } from "react";

import { compileMDX } from "@fumadocs/mdx-remote";
import "server-only";

import type { schema } from "@chia/db";
import { ContentType } from "@chia/db/types";

import type { Props } from "@/app/(blog)/_components/content";
import { fumadocsComponents } from "@/mdx-components";

export const compileFeed = cache(async (content: string) => {
  return compileMDX({
    source: content,
    components: {
      ...fumadocsComponents,
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
      const compiled = await compileFeed(content.content ?? "");
      return {
        type: ContentType.Mdx,
        toc: compiled.toc,
        content: compiled.content,
      } satisfies Props;
    }
    default: {
      return {
        type: contentType,
        content: content.content,
      } satisfies Props;
    }
  }
};
