import { cache } from "react";

import type { VirtualFile } from "fumadocs-core/source";
import { loader } from "fumadocs-core/source";
import matter from "gray-matter";

import { getNoteBySlug, getPostBySlug } from "./feeds.service";

type ResolvedFile = Omit<VirtualFile, "type" | "data"> & {
  type: "page";
  data: Record<string, unknown> & {
    data: {
      content: string;
    };
  };
};

const createSource = async (slug: string, type: "note" | "post") => {
  const feed = await (type === "note" ? getNoteBySlug : getPostBySlug)(
    slug,
    type
  );

  if (!feed) {
    throw new Error("Feed not found");
  }

  const content =
    (type === "note" ? feed.note?.content : feed.post?.content) || "";

  const { data } = matter(content);

  return {
    path: feed.slug,
    type: "page",
    data: {
      ...data,
      data: {
        content,
      },
    },
  } satisfies ResolvedFile;
};

export const getDoc = cache(async (slug: string, type: "note" | "post") => {
  return loader({
    source: {
      files: [await createSource(slug, type)],
    },
  });
});
