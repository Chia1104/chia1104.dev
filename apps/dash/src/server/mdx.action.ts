"use server";

import { compileMDX } from "@chia/mdx/src/core";

export const compile = async (mdx: string) => {
  const { content } = await compileMDX(mdx);
  return content;
};
