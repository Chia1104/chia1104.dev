import { diffLines } from "diff";

import type { ContentEdit } from "./index.ts";

type DiffPart = ReturnType<typeof diffLines>[number];

/** A run both texts share, or one change: lines removed, lines added, or a removal and the addition right after it. */
type DiffHunk =
  | { kind: "same"; part: DiffPart }
  | { kind: "removed"; removed: DiffPart }
  | { kind: "added"; added: DiffPart }
  | { kind: "replaced"; removed: DiffPart; added: DiffPart };

function* hunksOf(parts: readonly DiffPart[]): Generator<DiffHunk> {
  let removed: DiffPart | undefined;
  for (const part of parts) {
    if (part.added) {
      yield removed
        ? { kind: "replaced", removed, added: part }
        : { kind: "added", added: part };
      removed = undefined;
      continue;
    }
    if (removed) yield { kind: "removed", removed };
    removed = undefined;
    if (part.removed) removed = part;
    else yield { kind: "same", part };
  }
  if (removed) yield { kind: "removed", removed };
}

/** Overlapping matches count too: a target that also starts one character earlier names two places. */
const countOf = (haystack: string, needle: string): number => {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + 1);
  }
  return count;
};

/**
 * The edits that turn `before` into `after` through `applyEdits` with `exactOnly`: one per
 * changed run of lines, in order, each target widened by whole lines until it is the only such
 * text in the content the earlier edits produced. Carrying their own context is what lets the
 * edits land on a body someone else changed elsewhere, and fail on one changed in the same
 * place. An empty `before` has nothing to anchor on and is a whole-value write, not an edit.
 */
export const toEdits = (before: string, after: string): ContentEdit[] => {
  if (before === after) return [];
  if (before.length === 0) {
    throw new Error("An empty text has no target to edit; write the value.");
  }

  const edits: ContentEdit[] = [];
  let current = before;
  let cursor = 0;
  for (const hunk of hunksOf(diffLines(before, after))) {
    if (hunk.kind === "same") {
      cursor += hunk.part.value.length;
      continue;
    }
    const removed = "removed" in hunk ? hunk.removed.value : "";
    const added = "added" in hunk ? hunk.added.value : "";

    let start = cursor;
    let end = cursor + removed.length;
    const target = () => current.slice(start, end);
    while (
      (end === start || countOf(current, target()) !== 1) &&
      (start > 0 || end < current.length)
    ) {
      if (start > 0) {
        start = start >= 2 ? current.lastIndexOf("\n", start - 2) + 1 : 0;
      }
      if (end < current.length) {
        const newline = current.indexOf("\n", end);
        end = newline === -1 ? current.length : newline + 1;
      }
    }

    const head = current.slice(start, cursor);
    const tail = current.slice(cursor + removed.length, end);
    edits.push({
      oldString: target(),
      newString: `${head}${added}${tail}`,
    });
    current = `${current.slice(0, cursor)}${added}${current.slice(cursor + removed.length)}`;
    cursor += added.length;
  }
  return edits;
};

/** `Added` and `Modified` cover lines of `after`; `Deleted` marks the line that lines of `before` are gone above. */
export const LineChangeKind = {
  Added: "added",
  Modified: "modified",
  Deleted: "deleted",
} as const;

export type LineChangeKind =
  (typeof LineChangeKind)[keyof typeof LineChangeKind];

export interface LineChange {
  kind: LineChangeKind;
  /** 1-based, in `after`. */
  startLine: number;
  endLine: number;
}

/** How `after` differs from `before`, by line, for marking a gutter the way an editor's change bar does. */
export const lineChangesOf = (before: string, after: string): LineChange[] => {
  if (before === after) return [];
  const changes: LineChange[] = [];
  const lastLine = after.split("\n").length;
  let line = 1;
  for (const hunk of hunksOf(diffLines(before, after))) {
    switch (hunk.kind) {
      case "same":
        line += hunk.part.count ?? 0;
        break;
      case "replaced": {
        const added = hunk.added.count ?? 0;
        changes.push({
          kind: LineChangeKind.Modified,
          startLine: line,
          endLine: line + added - 1,
        });
        line += added;
        break;
      }
      case "added": {
        const added = hunk.added.count ?? 0;
        changes.push({
          kind: LineChangeKind.Added,
          startLine: line,
          endLine: line + added - 1,
        });
        line += added;
        break;
      }
      case "removed": {
        const at = Math.min(line, lastLine);
        changes.push({
          kind: LineChangeKind.Deleted,
          startLine: at,
          endLine: at,
        });
        break;
      }
      default: {
        const _exhaustive: never = hunk;
        void _exhaustive;
      }
    }
  }
  return changes;
};

export interface TextChange {
  /** Offsets in `before`; `start === end` inserts. */
  start: number;
  end: number;
  text: string;
}

/**
 * The smallest replacements that turn `before` into `after`, as offsets in `before`: one per
 * changed run of lines, narrowed to the characters that differ inside it. For applying someone
 * else's change to a text being edited, where everything left alone keeps the cursor, the
 * selection and the undo history attached to it.
 */
export const textChangesOf = (before: string, after: string): TextChange[] => {
  if (before === after) return [];
  const changes: TextChange[] = [];
  let offset = 0;
  for (const hunk of hunksOf(diffLines(before, after))) {
    if (hunk.kind === "same") {
      offset += hunk.part.value.length;
      continue;
    }
    const removed = "removed" in hunk ? hunk.removed.value : "";
    const added = "added" in hunk ? hunk.added.value : "";

    let head = 0;
    const limit = Math.min(removed.length, added.length);
    while (head < limit && removed[head] === added[head]) head += 1;
    let tail = 0;
    while (
      tail < limit - head &&
      removed[removed.length - 1 - tail] === added[added.length - 1 - tail]
    ) {
      tail += 1;
    }
    changes.push({
      start: offset + head,
      end: offset + removed.length - tail,
      text: added.slice(head, added.length - tail),
    });
    offset += removed.length;
  }
  return changes;
};
