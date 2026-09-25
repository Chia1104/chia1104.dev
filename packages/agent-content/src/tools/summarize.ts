import {
  asJsonArray,
  asJsonObject,
  asNumber,
  asString,
} from "@chia/utils/json";
import type { JsonValue } from "@chia/utils/json";

import { ContentToolName } from "./registry.ts";

/**
 * One transcript line for a content read tool's successful result, or `undefined` for a tool
 * that is not one of these.
 */
export const summarizeContentToolResult = (
  toolName: string,
  value: JsonValue | undefined
): string | undefined => {
  const details = asJsonObject(value);

  switch (toolName) {
    case ContentToolName.SearchPosts: {
      const hits = asJsonArray(details?.hits);
      return hits ? `${hits.length} match(es).` : "Searched.";
    }
    case ContentToolName.GetPost: {
      const post = asJsonObject(details?.post);
      const slug = asString(post?.slug);
      return slug ? `Read \`${slug}\`.` : "Read post.";
    }
    case ContentToolName.ListPosts: {
      const posts = asJsonArray(details?.posts);
      const total = asNumber(details?.total);
      if (!posts) return "Listed posts.";
      return total === undefined
        ? `${posts.length} post(s).`
        : `${posts.length} of ${total} post(s).`;
    }
    case ContentToolName.ListTags: {
      const tags = asJsonArray(details?.tags);
      return tags ? `${tags.length} tag(s).` : "Listed tags.";
    }
    default:
      return undefined;
  }
};
