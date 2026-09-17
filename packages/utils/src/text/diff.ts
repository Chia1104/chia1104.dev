import { diffLines } from "diff";

import type { ContentEdit } from "./index.ts";

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
  const parts = diffLines(before, after);
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    if (!part.added && !part.removed) {
      cursor += part.value.length;
      continue;
    }
    const removed = part.removed ? part.value : "";
    const next = parts[index + 1];
    const added = part.added
      ? part.value
      : part.removed && next?.added
        ? next.value
        : "";
    if (part.removed && next?.added) index += 1;

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

export interface LineChange {
  /** `added` and `modified` cover lines of `after`; `deleted` marks the line that lines of `before` are gone above. */
  kind: "added" | "modified" | "deleted";
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
  const parts = diffLines(before, after);
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    const count = part.count ?? 0;
    if (!part.added && !part.removed) {
      line += count;
      continue;
    }
    const next = parts[index + 1];
    if (part.removed && next?.added) {
      const added = next.count ?? 0;
      changes.push({
        kind: "modified",
        startLine: line,
        endLine: line + added - 1,
      });
      line += added;
      index += 1;
    } else if (part.added) {
      changes.push({
        kind: "added",
        startLine: line,
        endLine: line + count - 1,
      });
      line += count;
    } else {
      const at = Math.min(line, lastLine);
      changes.push({ kind: "deleted", startLine: at, endLine: at });
    }
  }
  return changes;
};
