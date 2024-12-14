import type { compileMDX as _compileMDX } from "@fumadocs/mdx-remote";

import type { Content } from "@chia/db/schema";
import { ContentType } from "@chia/db/types";

import type { ContentProps } from "./types";

type CompileResult = ReturnType<typeof _compileMDX>;

// export const compileMDX: (
//   content: string,
//   components?: MDXComponents
// ) => CompileResult = (content: string, components?: MDXComponents) =>
//   _compileMDX({
//     source: content,
//     components: {
//       ...FumadocsComponents,
//       ...V1MDXComponents,
//       ...components,
//     },
//   });

export const getContentProps = async ({
  contentType,
  content,
  compileResult,
}: {
  compileResult: CompileResult;
  contentType: ContentType;
  content: Partial<
    Pick<Content, "content" | "source" | "unstable_serializedSource">
  >;
}) => {
  switch (contentType) {
    case ContentType.Mdx: {
      const compiled = await compileResult;
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
