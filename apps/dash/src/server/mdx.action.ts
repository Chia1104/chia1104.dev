"use server";

import { compileMDX, serializeMDX } from "@chia/mdx/src/core";

export const compile = async (mdx: string) => {
  const { compiledSource } = await serializeMDX(mdx);
  return compiledSource;
};
