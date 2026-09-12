export type ExactReplaceFailure = "empty_target" | "not_found" | "ambiguous";

export type ExactReplaceResult =
  | { ok: true; content: string; replacements: number }
  | { ok: false; reason: ExactReplaceFailure; message: string };

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
 * `oldString` → `newString`, byte for byte. A target that matches more than once is refused
 * unless `replaceAll`, never replaced at its first occurrence. Messages are written for the
 * caller that typed the target, human or model.
 */
export const replaceExact = (
  content: string,
  oldString: string,
  newString: string,
  replaceAll = false
): ExactReplaceResult => {
  if (oldString.length === 0) {
    return {
      ok: false,
      reason: "empty_target",
      message:
        "`oldString` must not be empty. Replace the whole body to start over.",
    };
  }

  const occurrences = countOccurrences(content, oldString);

  if (occurrences === 0) {
    return {
      ok: false,
      reason: "not_found",
      message:
        "`oldString` was not found. Read the current body again — whitespace and indentation must match exactly.",
    };
  }

  if (occurrences > 1 && !replaceAll) {
    return {
      ok: false,
      reason: "ambiguous",
      message: `\`oldString\` matches ${occurrences} places. Include more surrounding context to make it unique, or pass replaceAll: true.`,
    };
  }

  return {
    ok: true,
    // A function replacer inserts `newString` verbatim; a string one would expand `$&`, `$'` and
    // `` $` ``, and post bodies carry `$` for math.
    content: replaceAll
      ? content.split(oldString).join(newString)
      : content.replace(oldString, () => newString),
    replacements: replaceAll ? occurrences : 1,
  };
};
