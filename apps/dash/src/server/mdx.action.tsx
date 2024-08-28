"use server";

import { DocsBody } from "fumadocs-ui/page";

import { compileMDX } from "@chia/mdx/services";

export const compile = async (mdx: string) => {
  const { content } = await compileMDX(mdx);
  return (
    <DocsBody className="prose dark:prose-invert min-w-full prose-a:no-underline">
      {content}
    </DocsBody>
  );
};
