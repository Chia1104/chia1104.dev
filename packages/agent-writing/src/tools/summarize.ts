import { summarizeContentToolResult } from "@chia/agent-content/tools/summarize";
import { toolErrorText, toolResultDetails } from "@chia/agent-runtime/tools";
import {
  asJsonArray,
  asJsonObject,
  asNumber,
  asString,
} from "@chia/utils/json";
import { hostnameOf } from "@chia/utils/url";

import { TOOL_NAMES } from "./registry.ts";

/**
 * One transcript line per tool result. The full payload stays in `details`. `result` is
 * `unknown` because it arrives from pi as `any`.
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
    case TOOL_NAMES.readSkill: {
      const name = asString(details.name);
      return name ? `Read skill \`${name}\`.` : "Read skill.";
    }
    case TOOL_NAMES.webSearch: {
      const query = asString(details.query);
      const count = asNumber(details.count);
      return query
        ? `Searched "${query}"${count === undefined ? "" : ` (${count} results)`}.`
        : "Searched the web.";
    }
    case TOOL_NAMES.fetchUrl: {
      const url = asString(details.url);
      return url ? `Fetched ${hostnameOf(url)}.` : "Fetched page.";
    }
    case TOOL_NAMES.githubResolveRef: {
      const repo = asString(details.repo);
      const sha = asString(details.sha);
      return repo && sha
        ? `Resolved ${repo}@${asString(details.ref) ?? "default"} to ${sha.slice(0, 7)}.`
        : "Resolved a GitHub ref.";
    }
    case TOOL_NAMES.githubListTree: {
      const repo = asString(details.repo);
      const path = asString(details.path);
      const count = asNumber(details.count);
      return repo
        ? `Listed ${repo}/${path || ""}${count === undefined ? "" : ` (${count} entries)`}.`
        : "Listed a GitHub tree.";
    }
    case TOOL_NAMES.githubReadFile: {
      const repo = asString(details.repo);
      const path = asString(details.path);
      const sha = asString(details.sha);
      return repo && path
        ? `Read ${repo}/${path}${sha ? `@${sha.slice(0, 7)}` : ""}.`
        : "Read a GitHub file.";
    }
    case TOOL_NAMES.searchMemory: {
      const query = asString(details.query);
      const hits = asJsonArray(details.hits);
      return query
        ? `Searched memory for "${query}"${hits ? ` (${hits.length} hits)` : ""}.`
        : "Searched memory.";
    }
    case TOOL_NAMES.getMemory: {
      const id = asNumber(details.id);
      return id === undefined ? "Read memory." : `Read memory #${id}.`;
    }
    case TOOL_NAMES.saveMemory: {
      const id = asNumber(details.id);
      return id === undefined ? "Saved memory." : `Saved memory #${id}.`;
    }
    case TOOL_NAMES.proposeLesson: {
      const id = asNumber(details.id);
      return id === undefined
        ? "Proposed a lesson for review."
        : `Proposed lesson #${id} for review.`;
    }
    case TOOL_NAMES.newDraft:
    case TOOL_NAMES.openDraft: {
      const draftId = asNumber(details.draftId);
      const feedId = asNumber(details.feedId);
      if (draftId === undefined) return "Opened draft.";
      return feedId === undefined
        ? `Opened draft #${draftId} for a new post.`
        : `Opened draft #${draftId} for feed ${feedId}.`;
    }
    case TOOL_NAMES.readDraft: {
      const locale = asString(details.locale);
      const lineCount = asNumber(details.lineCount);
      const heading = asString(details.heading);
      if (locale && heading) {
        return `Read ${locale} section "${heading}" (${lineCount ?? 0} lines).`;
      }
      if (locale && lineCount !== undefined) {
        return `Read ${locale} draft (${lineCount} lines).`;
      }
      return "Read draft metadata.";
    }
    case TOOL_NAMES.writeDraft: {
      const warnings = asJsonArray(details.warnings);
      const written = asJsonObject(details.translations);
      const locales = written ? Object.keys(written) : [];
      const scope =
        locales.length > 0 ? `Wrote ${locales.join(", ")}` : "Updated metadata";
      return warnings && warnings.length > 0
        ? `${scope} with ${warnings.length} warning(s).`
        : `${scope}.`;
    }
    case TOOL_NAMES.editDraftContent: {
      const replacements = asNumber(details.replacements) ?? 0;
      const edits = asJsonArray(details.edits);
      const locale = asString(details.locale);
      const loose =
        edits?.filter((edit) => asJsonObject(edit)?.match !== "exact").length ??
        0;
      return (
        `${replacements} replacement(s) across ${edits?.length ?? 1} edit(s) in ${locale ?? "draft"}` +
        `${loose > 0 ? `, ${loose} matched loosely` : ""}.`
      );
    }
    case TOOL_NAMES.replaceSection: {
      const heading = asString(details.heading);
      const locale = asString(details.locale);
      return details.deleted === true
        ? `Deleted section "${heading ?? "?"}" in ${locale ?? "draft"}.`
        : `Replaced section "${heading ?? "?"}" in ${locale ?? "draft"}.`;
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
