import type { Locale } from "@chia/db/types";
import { mergeDefined } from "@chia/utils/object";

import type { DraftFeedMeta, DraftTranslation, FeedDraft } from "../types.ts";

export const emptyDraft = (): FeedDraft => ({
  feedMeta: {},
  translations: {},
});

export const patchFeedMeta = (
  draft: FeedDraft,
  patch: DraftFeedMeta
): FeedDraft => ({
  ...draft,
  feedMeta: mergeDefined(draft.feedMeta, patch),
});

export const patchTranslation = (
  draft: FeedDraft,
  locale: Locale,
  patch: DraftTranslation
): FeedDraft => ({
  ...draft,
  translations: {
    ...draft.translations,
    [locale]: mergeDefined(draft.translations[locale] ?? {}, patch),
  },
});

export const setContent = (
  draft: FeedDraft,
  locale: Locale,
  content: string
): FeedDraft => patchTranslation(draft, locale, { content });

export class EditNotAppliedError extends Error {
  constructor(
    message: string,
    readonly reason: "not_found" | "ambiguous" | "empty_target"
  ) {
    super(message);
    this.name = "EditNotAppliedError";
  }
}

export interface EditResult {
  content: string;
  replacements: number;
}

/**
 * `oldString` → `newString` replacement. A non-unique match without `replaceAll` is an error,
 * not a first-match replacement.
 */
export const applyEdit = (
  content: string,
  oldString: string,
  newString: string,
  replaceAll = false
): EditResult => {
  if (oldString.length === 0) {
    throw new EditNotAppliedError(
      "`oldString` must not be empty. Use write_draft_content to replace the whole body.",
      "empty_target"
    );
  }

  const occurrences = countOccurrences(content, oldString);

  if (occurrences === 0) {
    throw new EditNotAppliedError(
      "`oldString` was not found in the draft. Read the draft again — whitespace and indentation must match exactly.",
      "not_found"
    );
  }

  if (occurrences > 1 && !replaceAll) {
    throw new EditNotAppliedError(
      `\`oldString\` matches ${occurrences} places. Include more surrounding context to make it unique, or pass replaceAll: true.`,
      "ambiguous"
    );
  }

  return {
    content: replaceAll
      ? content.split(oldString).join(newString)
      : content.replace(oldString, newString),
    replacements: replaceAll ? occurrences : 1,
  };
};

const countOccurrences = (haystack: string, needle: string): number => {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
};

/**
 * Renders the body with 1-based line numbers so the model can locate `oldString`.
 */
export const withLineNumbers = (content: string): string => {
  const lines = content.split("\n");
  const width = String(lines.length).length;
  return lines
    .map((line, index) => `${String(index + 1).padStart(width, " ")}\t${line}`)
    .join("\n");
};
