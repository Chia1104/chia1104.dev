import { toolResultDetails } from "@chia/agent-runtime/tools";
import { asJsonArray, asJsonObject, asString } from "@chia/utils/json";

import { CONTENT_TOOL_NAMES } from "./registry.ts";

/**
 * One transcript line for a content read tool's result, or `undefined` for a tool that is not
 * one of these. Errors are handled by the kind's summarizer before dispatch.
 */
export const summarizeContentToolResult = <TResult>(
  toolName: string,
  result: TResult
): string | undefined => {
  const details = toolResultDetails(result);

  switch (toolName) {
    case CONTENT_TOOL_NAMES.searchPosts: {
      const hits = asJsonArray(details?.hits);
      return hits ? `${hits.length} match(es).` : "Searched.";
    }
    case CONTENT_TOOL_NAMES.getPost: {
      const post = asJsonObject(details?.post);
      const slug = asString(post?.slug);
      return slug ? `Read \`${slug}\`.` : "Read post.";
    }
    case CONTENT_TOOL_NAMES.listPosts: {
      const posts = asJsonArray(details?.posts);
      return posts ? `${posts.length} post(s).` : "Listed posts.";
    }
    case CONTENT_TOOL_NAMES.listTags: {
      const tags = asJsonArray(details?.tags);
      return tags ? `${tags.length} tag(s).` : "Listed tags.";
    }
    default:
      return undefined;
  }
};
