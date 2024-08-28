"use server";

import { createStreamableUI } from "ai/rsc";
import { DocsBody } from "fumadocs-ui/page";

import { compileMDX } from "@chia/mdx/services";

export const compile = async (mdx: string) => {
  const rsc = createStreamableUI();
  const { content } = await compileMDX(mdx);
  rsc.done(
    <DocsBody className="prose dark:prose-invert min-w-full prose-a:no-underline">
      {content}
    </DocsBody>
  );
  return rsc.value;
};
