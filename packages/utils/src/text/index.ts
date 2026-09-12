export type ExactReplaceFailure = "empty_target" | "not_found" | "ambiguous";

export type ExactReplaceResult =
  | {
      ok: true;
      content: string;
      replacements: number;
      /** Where each replacement starts in `content`. */
      offsets: number[];
    }
  | { ok: false; reason: ExactReplaceFailure; message: string };

const occurrencesOf = (haystack: string, needle: string): number[] => {
  const found: number[] = [];
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    found.push(index);
    index = haystack.indexOf(needle, index + needle.length);
  }
  return found;
};

/**
 * `oldString` → `newString`, byte for byte and inserted verbatim. A target that matches more
 * than once is refused unless `replaceAll`, never replaced at its first occurrence. Messages
 * are written for the caller that typed the target, human or model.
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

  const found = occurrencesOf(content, oldString);

  if (found.length === 0) {
    return {
      ok: false,
      reason: "not_found",
      message:
        "`oldString` was not found. Read the current body again — whitespace and indentation must match exactly.",
    };
  }

  if (found.length > 1 && !replaceAll) {
    return {
      ok: false,
      reason: "ambiguous",
      message: `\`oldString\` matches ${found.length} places. Include more surrounding context to make it unique, or pass replaceAll: true.`,
    };
  }

  const targets = replaceAll ? found : found.slice(0, 1);
  let next = "";
  let cursor = 0;
  const offsets: number[] = [];
  for (const at of targets) {
    next += content.slice(cursor, at);
    offsets.push(next.length);
    next += newString;
    cursor = at + oldString.length;
  }
  next += content.slice(cursor);

  return { ok: true, content: next, replacements: targets.length, offsets };
};

/** 1-based line of a character offset. */
export const lineAt = (content: string, offset: number): number => {
  let line = 1;
  const end = Math.min(offset, content.length);
  for (let index = 0; index < end; index += 1) {
    if (content.charCodeAt(index) === 10) line += 1;
  }
  return line;
};

/** `text` with 1-based line numbers, right-aligned so the body stays readable past line 9. */
export const numberLines = (text: string, firstLine = 1): string => {
  const lines = text.split("\n");
  const width = String(firstLine + lines.length - 1).length;
  return lines
    .map(
      (line, index) =>
        `${String(firstLine + index).padStart(width, " ")}\t${line}`
    )
    .join("\n");
};

export interface Excerpt {
  /** 1-based line the offset falls on. */
  line: number;
  /** Numbered lines from `line - radius` through `line + radius`, clamped to the text. */
  text: string;
}

/** The numbered lines around `offset`, for showing where an edit landed without re-reading. */
export const excerptAround = (
  content: string,
  offset: number,
  radius = 2
): Excerpt => {
  const lines = content.split("\n");
  const line = lineAt(content, offset);
  const from = Math.max(1, line - radius);
  const to = Math.min(lines.length, line + radius);
  return {
    line,
    text: numberLines(lines.slice(from - 1, to).join("\n"), from),
  };
};

export interface ContentEdit {
  oldString: string;
  newString: string;
  replaceAll?: boolean;
}

export interface AppliedEdit {
  replacements: number;
  /** Where each replacement starts in the final content. */
  offsets: number[];
}

export type ApplyEditsResult =
  | { ok: true; content: string; edits: AppliedEdit[] }
  /** Edit `index` did not match once; nothing before it counts. */
  | { ok: false; index: number; reason: ExactReplaceFailure; message: string };

/**
 * Exact replacements in order, each against the content the previous one produced. Offsets
 * come out relative to the final content: a later edit landing above an earlier one shifts
 * the earlier offsets.
 */
export const applyEdits = (
  content: string,
  edits: readonly ContentEdit[]
): ApplyEditsResult => {
  let current = content;
  const applied: AppliedEdit[] = [];
  for (const [index, edit] of edits.entries()) {
    const result = replaceExact(
      current,
      edit.oldString,
      edit.newString,
      edit.replaceAll ?? false
    );
    if (!result.ok) {
      return {
        ok: false,
        index,
        reason: result.reason,
        message: result.message,
      };
    }
    const delta = edit.newString.length - edit.oldString.length;
    const landedAt = result.offsets.map((offset, k) => offset - k * delta);
    for (const previous of applied) {
      previous.offsets = previous.offsets.map(
        (offset) => offset + landedAt.filter((at) => at < offset).length * delta
      );
    }
    current = result.content;
    applied.push({
      replacements: result.replacements,
      offsets: result.offsets,
    });
  }
  return { ok: true, content: current, edits: applied };
};
