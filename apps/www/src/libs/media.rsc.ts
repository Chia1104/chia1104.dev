import "server-only";
import { ORPCError } from "@orpc/client";

import { client } from "@/libs/orpc/client.rsc";
import { MEDIA_KIND_SEGMENT } from "@/shared/media";
import type { MediaEntry } from "@/shared/media";

/**
 * The work a `/hobby/[kind]/[slug]` URL names, or `null` when there is none. The kind is part of
 * the URL, so a slug under another kind's path is not that work's address.
 */
export const mediaEntryOf = async (
  kindSegment: string,
  slug: string
): Promise<MediaEntry | null> => {
  try {
    const { entry } = await client.media.get({ slug });
    return MEDIA_KIND_SEGMENT[entry.kind] === kindSegment ? entry : null;
  } catch (error) {
    if (error instanceof ORPCError && error.code === "NOT_FOUND") return null;
    throw error;
  }
};
