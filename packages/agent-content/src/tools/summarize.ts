import {
  asArray,
  asRecord,
  toolResultDetails,
} from "@chia/agent-runtime/tools";

import { CONTENT_TOOL_NAMES } from "./registry.ts";

/**
 * One transcript line for a content read tool's result, or `undefined` for a tool that is not
 * one of ours — so a kind's summarizer can try this first and fall through to its own tools.
 *
 * Errors are not handled here: how an error reads is the same for every tool, so the kind's
 * summarizer does that once before dispatching.
 */
export const summarizeContentToolResult = (
  toolName: string,
  result: unknown
): string | undefined => {
  const details = toolResultDetails(result);

  switch (toolName) {
    case CONTENT_TOOL_NAMES.searchPosts: {
      const hits = asArray(details?.hits);
      return hits ? `${hits.length} match(es).` : "Searched.";
    }
    case CONTENT_TOOL_NAMES.getPost: {
      const post = asRecord(details?.post);
      const slug = typeof post?.slug === "string" ? post.slug : undefined;
      return slug ? `Read \`${slug}\`.` : "Read post.";
    }
    case CONTENT_TOOL_NAMES.listPosts: {
      const posts = asArray(details?.posts);
      return posts ? `${posts.length} post(s).` : "Listed posts.";
    }
    case CONTENT_TOOL_NAMES.listTags: {
      const tags = asArray(details?.tags);
      return tags ? `${tags.length} tag(s).` : "Listed tags.";
    }
    default:
      return undefined;
  }
};
