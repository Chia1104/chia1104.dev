import { summarizeContentToolResult } from "@chia/agent-content/tools/summarize";
import {
  asArray,
  asNumber,
  asString,
  toolErrorText,
  toolResultDetails,
} from "@chia/agent-runtime/tools";

import { TOOL_NAMES } from "./registry.ts";

/**
 * Condenses a tool result into one transcript line.
 *
 * This is what keeps the wire events small: a `get_post` result can be tens of kilobytes, but
 * the transcript only needs "Read post `some-slug`". The full payload stays in `details` for
 * the tool card to expand.
 *
 * `result` is `unknown` because it arrives from pi as `any` — every branch narrows defensively
 * rather than trusting the shape.
 */
export const summarizeToolResult = <TResult>(
  toolName: string,
  result: TResult,
  isError: boolean
): string => {
  if (isError) return toolErrorText(result) ?? "Failed.";

  const shared = summarizeContentToolResult(toolName, result);
  if (shared !== undefined) return shared;

  const details = toolResultDetails(result);
  if (!details) return "Done.";

  switch (toolName) {
    case TOOL_NAMES.webSearch: {
      const query = asString(details.query);
      const count = asNumber(details.count);
      return query
        ? `Searched "${query}"${count === undefined ? "" : ` (${count} results)`}.`
        : "Searched the web.";
    }
    case TOOL_NAMES.fetchUrl: {
      const url = asString(details.url);
      return url ? `Fetched ${hostOf(url)}.` : "Fetched page.";
    }
    case TOOL_NAMES.readDraft: {
      const locale = asString(details.locale);
      const lineCount = asNumber(details.lineCount);
      if (locale && lineCount !== undefined) {
        return `Read ${locale} draft (${lineCount} lines).`;
      }
      return "Read draft metadata.";
    }
    case TOOL_NAMES.patchDraftMeta: {
      const warnings = asArray(details.warnings);
      return warnings && warnings.length > 0
        ? `Metadata updated with ${warnings.length} warning(s).`
        : "Metadata updated.";
    }
    case TOOL_NAMES.writeDraftContent: {
      const locale = asString(details.locale);
      const lineCount = asNumber(details.lineCount);
      return `Wrote ${locale ?? "draft"} body${lineCount === undefined ? "" : ` (${lineCount} lines)`}.`;
    }
    case TOOL_NAMES.editDraftContent: {
      const replacements = asNumber(details.replacements) ?? 0;
      const locale = asString(details.locale);
      return `${replacements} replacement(s) in ${locale ?? "draft"}.`;
    }
    case TOOL_NAMES.slugify: {
      const slug = asString(details.slug);
      return slug ? `\`${slug}\`` : "Slugified.";
    }
    case TOOL_NAMES.commitDraft: {
      const feedId = asNumber(details.feedId);
      const created = details.created === true;
      return feedId === undefined
        ? "Committed."
        : `${created ? "Created" : "Updated"} feed ${feedId}.`;
    }
    case TOOL_NAMES.setPublished:
      return details.published === true ? "Published." : "Unpublished.";
    default:
      return "Done.";
  }
};

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};
