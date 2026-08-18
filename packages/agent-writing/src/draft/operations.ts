import type { Locale } from "@chia/db/types";

import type { DraftFeedMeta, DraftTranslation, FeedDraft } from "../types.ts";

/**
 * Pure draft-buffer operations, shared by every {@link DraftStore} implementation and
 * directly unit-testable. Nothing here touches IO.
 */

export const emptyDraft = (): FeedDraft => ({
  feedMeta: {},
  translations: {},
});

/**
 * Merges a partial patch, treating `undefined` as "leave alone" and `null` as "clear".
 *
 * The distinction matters: the model routinely omits fields it is not changing, and
 * dropping that difference would silently wipe an excerpt on every metadata patch.
 */
const mergeDefined = <T extends object>(base: T, patch: Partial<T>): T => {
  const next = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    Object.assign(next, { [key]: value });
  }
  return next;
};

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

// ============================================
// String editing
// ============================================

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
 * `oldString` → `newString` replacement with the same safety rules as pi's built-in edit
 * tool: a non-unique match without `replaceAll` is an **error**, not a first-match
 * replacement. Silently editing the wrong occurrence is far worse for the model than an
 * error it can react to by supplying more surrounding context.
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

// ============================================
// Rendering for the model
// ============================================

/**
 * Renders the body with 1-based line numbers.
 *
 * Line numbers are not decoration: without them the model cannot describe *where* it wants
 * to change something, and its `oldString` guesses get much worse on long posts.
 */
export const withLineNumbers = (content: string): string => {
  const lines = content.split("\n");
  const width = String(lines.length).length;
  return lines
    .map((line, index) => `${String(index + 1).padStart(width, " ")}\t${line}`)
    .join("\n");
};
