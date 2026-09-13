export type ExactReplaceFailure = "empty_target" | "not_found" | "ambiguous";

/**
 * How loosely the target was matched, in the order the rounds run: `exact` byte for byte;
 * `trailing_whitespace` ignoring whitespace at the end of each line; `whitespace` ignoring it
 * at both ends; `punctuation` also reading typographic dashes, quotes and spaces as their ASCII
 * forms. Word content never varies: whitespace dropped from the target's outer edges must
 * meet a non-word character or the text's edge, so a fragment never matches inside a word. The
 * first round that matches wins.
 */
export type MatchMode =
  | "exact"
  | "trailing_whitespace"
  | "whitespace"
  | "punctuation";

/** One matched span of the input content. */
export interface MatchSpan {
  start: number;
  end: number;
}

export type ExactReplaceResult =
  | {
      ok: true;
      content: string;
      replacements: number;
      /** Where each replacement starts in `content`. */
      offsets: number[];
      /** What each replacement removed, in the input content. */
      matches: MatchSpan[];
      match: MatchMode;
    }
  | { ok: false; reason: ExactReplaceFailure; message: string };

const occurrencesOf = (haystack: string, needle: string): MatchSpan[] => {
  const found: MatchSpan[] = [];
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    found.push({ start: index, end: index + needle.length });
    index = haystack.indexOf(needle, index + needle.length);
  }
  return found;
};

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Sets of characters that stand in for each other: dashes, single quotes, double quotes, spaces. */
const PUNCTUATION_SETS = [
  "-\u2010\u2011\u2012\u2013\u2014\u2015\u2212",
  "'\u2018\u2019\u201A\u201B",
  '"\u201C\u201D\u201E\u201F',
  " \u00A0\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000",
] as const;

const punctuationSetOf = new Map<string, string>();
for (const set of PUNCTUATION_SETS) {
  for (const char of set) punctuationSetOf.set(char, set);
}

/** A pattern for one line of the target, letting the characters of a set stand in for each other. */
const punctuationPattern = (line: string) =>
  Array.from(line, (char) => {
    const set = punctuationSetOf.get(char);
    return set ? `[${escapeRegExp(set)}]` : escapeRegExp(char);
  }).join("");

const HORIZONTAL_SPACE = "[ \\t\\u00A0\\u2000-\\u200A\\u202F\\u205F\\u3000]*";

/** Letters, digits and underscore in any script; what a dropped edge space must not touch. */
const WORD_CHAR = "[\\p{L}\\p{N}_]";

/**
 * A regex that finds the target under one relaxed round. Whitespace inside the match is
 * absorbed at line boundaries only, so the indentation before the first line and the space
 * after the last stay in the content rather than being replaced.
 */
const relaxedPattern = (target: string, mode: Exclude<MatchMode, "exact">) => {
  const raw = target.split("\n");
  const lines = raw.map((line) => {
    const trimmed =
      mode === "trailing_whitespace" ? line.trimEnd() : line.trim();
    return mode === "punctuation"
      ? punctuationPattern(trimmed)
      : escapeRegExp(trimmed);
  });
  const boundary =
    mode === "trailing_whitespace"
      ? `[ \\t]*\\n`
      : `${HORIZONTAL_SPACE}\\n${HORIZONTAL_SPACE}`;
  const first = raw[0] ?? "";
  const last = raw[raw.length - 1] ?? "";
  const leadDropped =
    mode !== "trailing_whitespace" && first !== first.trimStart();
  const tailDropped = last !== last.trimEnd();
  return new RegExp(
    `${leadDropped ? `(?<!${WORD_CHAR})` : ""}${lines.join(boundary)}${tailDropped ? `(?!${WORD_CHAR})` : ""}`,
    "gu"
  );
};

const RELAXED_ROUNDS = [
  "trailing_whitespace",
  "whitespace",
  "punctuation",
] as const;

interface TargetMatch {
  spans: MatchSpan[];
  match: MatchMode;
}

const findTarget = (content: string, target: string): TargetMatch => {
  const exact = occurrencesOf(content, target);
  if (exact.length > 0) return { spans: exact, match: "exact" };
  for (const mode of RELAXED_ROUNDS) {
    const spans = Array.from(
      content.matchAll(relaxedPattern(target, mode)),
      (found) => ({
        start: found.index,
        end: found.index + found[0].length,
      })
    ).filter((span) => span.end > span.start);
    if (spans.length > 0) return { spans, match: mode };
  }
  return { spans: [], match: "exact" };
};

/**
 * `oldString` → `newString`, inserted verbatim. The target is matched byte for byte first and
 * then under each looser `MatchMode` in turn. A target that matches more than once is refused
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

  const { spans, match } = findTarget(content, oldString);

  if (spans.length === 0) {
    return {
      ok: false,
      reason: "not_found",
      message:
        "`oldString` was not found, even ignoring whitespace and quote or dash style. Read the current body again and copy the target from it.",
    };
  }

  if (spans.length > 1 && !replaceAll) {
    return {
      ok: false,
      reason: "ambiguous",
      message: `\`oldString\` matches ${spans.length} places. Include more surrounding context to make it unique, or pass replaceAll: true.`,
    };
  }

  const targets = replaceAll ? spans : spans.slice(0, 1);
  let next = "";
  let cursor = 0;
  const offsets: number[] = [];
  for (const span of targets) {
    next += content.slice(cursor, span.start);
    offsets.push(next.length);
    next += newString;
    cursor = span.end;
  }
  next += content.slice(cursor);

  return {
    ok: true,
    content: next,
    replacements: targets.length,
    offsets,
    matches: targets,
    match,
  };
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
  match: MatchMode;
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
    // A relaxed match removes a span of a different length than `oldString`, so each shift
    // comes from the span itself; an earlier replacement this edit swallowed moves to where
    // its replacement starts.
    const remap = (offset: number): number => {
      let shifted = offset;
      for (const [k, span] of result.matches.entries()) {
        if (span.end <= offset) {
          shifted += edit.newString.length - (span.end - span.start);
        } else if (span.start <= offset) {
          return result.offsets[k] ?? shifted;
        }
      }
      return shifted;
    };
    for (const previous of applied) {
      previous.offsets = previous.offsets.map(remap);
    }
    current = result.content;
    applied.push({
      replacements: result.replacements,
      offsets: result.offsets,
      match: result.match,
    });
  }
  return { ok: true, content: current, edits: applied };
};
