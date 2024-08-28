"use server";

import { compileMDX } from "@chia/mdx/services";

export const compile = async (mdx: string) => {
  const { content } = await compileMDX(mdx);
  return content;
};
