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
export const summarizeToolResult = (
  toolName: string,
  result: unknown,
  isError: boolean
): string => {
  if (isError) return errorText(result) ?? "Failed.";

  const details = extractDetails(result);
  if (!details) return "Done.";

  switch (toolName) {
    case TOOL_NAMES.searchPosts: {
      const hits = asArray(details.hits);
      return hits ? `${hits.length} match(es).` : "Searched.";
    }
    case TOOL_NAMES.getPost: {
      const post = asRecord(details.post);
      const slug = typeof post?.slug === "string" ? post.slug : undefined;
      return slug ? `Read \`${slug}\`.` : "Read post.";
    }
    case TOOL_NAMES.listPosts: {
      const posts = asArray(details.posts);
      return posts ? `${posts.length} post(s).` : "Listed posts.";
    }
    case TOOL_NAMES.listTags: {
      const tags = asArray(details.tags);
      return tags ? `${tags.length} tag(s).` : "Listed tags.";
    }
    case TOOL_NAMES.fetchUrl: {
      const url = typeof details.url === "string" ? details.url : undefined;
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

// ============================================
// Narrowing helpers
// ============================================

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const asArray = (value: unknown): unknown[] | undefined =>
  Array.isArray(value) ? value : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

/**
 * Tool results arrive either as pi's `AgentToolResult` (`{ content, details }`) or as a
 * persisted `ToolResultMessage` (also `{ content, details }`), so one accessor covers both.
 */
const extractDetails = (result: unknown): Record<string, unknown> | undefined =>
  asRecord(asRecord(result)?.details);

const errorText = (result: unknown): string | undefined => {
  const record = asRecord(result);
  const content = asArray(record?.content);
  const first = asRecord(content?.[0]);
  const text = asString(first?.text);
  if (!text) return undefined;
  // Keep the transcript to one line; the card shows the whole thing.
  const [firstLine] = text.split("\n");
  return firstLine && firstLine.length > 160
    ? `${firstLine.slice(0, 160)}…`
    : firstLine;
};

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};
