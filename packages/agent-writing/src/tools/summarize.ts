import { summarizeContentToolResult } from "@chia/agent-content/tools/summarize";
import {
  asJsonArray,
  asJsonObject,
  asNumber,
  asString,
} from "@chia/utils/json";
import type { JsonValue } from "@chia/utils/json";
import { MatchMode } from "@chia/utils/text";
import { hostnameOf } from "@chia/utils/url";

import { ToolName } from "./registry.ts";

/** One transcript line per successful tool result. The full payload stays in `details`. */
export const summarizeToolResult = (
  toolName: string,
  value: JsonValue | undefined
): string => {
  const shared = summarizeContentToolResult(toolName, value);
  if (shared !== undefined) return shared;

  const details = asJsonObject(value);
  if (!details) return "Done.";

  switch (toolName) {
    case ToolName.ReadSkill: {
      const name = asString(details.name);
      return name ? `Read skill \`${name}\`.` : "Read skill.";
    }
    case ToolName.WebSearch: {
      const query = asString(details.query);
      const count = asNumber(details.count);
      return query
        ? `Searched "${query}"${count === undefined ? "" : ` (${count} results)`}.`
        : "Searched the web.";
    }
    case ToolName.FetchUrl: {
      const url = asString(details.url);
      return url ? `Fetched ${hostnameOf(url)}.` : "Fetched page.";
    }
    case ToolName.GitHubResolveRef: {
      const repo = asString(details.repo);
      const sha = asString(details.sha);
      return repo && sha
        ? `Resolved ${repo}@${asString(details.ref) ?? "default"} to ${sha.slice(0, 7)}.`
        : "Resolved a GitHub ref.";
    }
    case ToolName.GitHubListTree: {
      const repo = asString(details.repo);
      const path = asString(details.path);
      const count = asNumber(details.count);
      return repo
        ? `Listed ${repo}/${path || ""}${count === undefined ? "" : ` (${count} entries)`}.`
        : "Listed a GitHub tree.";
    }
    case ToolName.GitHubReadFile: {
      const repo = asString(details.repo);
      const path = asString(details.path);
      const sha = asString(details.sha);
      return repo && path
        ? `Read ${repo}/${path}${sha ? `@${sha.slice(0, 7)}` : ""}.`
        : "Read a GitHub file.";
    }
    case ToolName.SearchMemory: {
      const query = asString(details.query);
      const hits = asJsonArray(details.hits);
      return query
        ? `Searched memory for "${query}"${hits ? ` (${hits.length} hits)` : ""}.`
        : "Searched memory.";
    }
    case ToolName.GetMemory: {
      const id = asNumber(details.id);
      return id === undefined ? "Read memory." : `Read memory #${id}.`;
    }
    case ToolName.SaveMemory: {
      const id = asNumber(details.id);
      return id === undefined ? "Saved memory." : `Saved memory #${id}.`;
    }
    case ToolName.ProposeLesson: {
      const id = asNumber(details.id);
      return id === undefined
        ? "Proposed a lesson for review."
        : `Proposed lesson #${id} for review.`;
    }
    case ToolName.NewDraft:
    case ToolName.OpenDraft: {
      const draftId = asNumber(details.draftId);
      const feedId = asNumber(details.feedId);
      if (draftId === undefined) return "Opened draft.";
      return feedId === undefined
        ? `Opened draft #${draftId} for a new post.`
        : `Opened draft #${draftId} for feed ${feedId}.`;
    }
    case ToolName.ReadDraft: {
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
    case ToolName.WriteDraft: {
      const warnings = asJsonArray(details.warnings);
      const written = asJsonObject(details.translations);
      const locales = written ? Object.keys(written) : [];
      const scope =
        locales.length > 0 ? `Wrote ${locales.join(", ")}` : "Updated metadata";
      return warnings && warnings.length > 0
        ? `${scope} with ${warnings.length} warning(s).`
        : `${scope}.`;
    }
    case ToolName.EditDraftContent: {
      const replacements = asNumber(details.replacements) ?? 0;
      const edits = asJsonArray(details.edits);
      const locale = asString(details.locale);
      const loose =
        edits?.filter((edit) => asJsonObject(edit)?.match !== MatchMode.Exact)
          .length ?? 0;
      return (
        `${replacements} replacement(s) across ${edits?.length ?? 1} edit(s) in ${locale ?? "draft"}` +
        `${loose > 0 ? `, ${loose} matched loosely` : ""}.`
      );
    }
    case ToolName.ReplaceSection: {
      const heading = asString(details.heading);
      const locale = asString(details.locale);
      return details.deleted === true
        ? `Deleted section "${heading ?? "?"}" in ${locale ?? "draft"}.`
        : `Replaced section "${heading ?? "?"}" in ${locale ?? "draft"}.`;
    }
    case ToolName.CommitDraft: {
      const feedId = asNumber(details.feedId);
      const created = details.created === true;
      return feedId === undefined
        ? "Committed."
        : `${created ? "Created" : "Updated"} feed ${feedId}.`;
    }
    case ToolName.SetPublished:
      return details.published === true ? "Published." : "Unpublished.";
    default:
      return "Done.";
  }
};
