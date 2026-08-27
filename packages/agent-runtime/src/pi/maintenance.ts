import { generateBranchSummary } from "@earendil-works/pi-agent-core";
import type { Api, Model, Models } from "@earendil-works/pi-ai";

import type {
  BranchSummaryEntry,
  LabelEntry,
  NewSessionEntry,
  SessionEntry,
} from "../session/entries.ts";
import { contextEntries } from "../session/entries.ts";
import type { SessionTree } from "../session/tree.ts";
import type { AgentSessionSettings } from "../types.ts";
import type {
  AgentCompactionResult,
  AgentNavigationOptions,
  AgentNavigationResult,
} from "../types.ts";

import { compactSession } from "./compaction.ts";
import { clampSessionThinkingLevel } from "./settings.ts";

export interface PiSessionOperationOptions {
  session: SessionTree;
  settings: AgentSessionSettings;
  model: Model<Api>;
  models: Models;
  /** Cancels the summary request; the tree is untouched when it fires. */
  signal?: AbortSignal;
}

/** Runs Pi's compaction over the session tree; no tools, prompts or subscriptions are built. */
export const compactPiSession = async (
  { session, settings, model, models, signal }: PiSessionOperationOptions,
  customInstructions?: string
): Promise<AgentCompactionResult> => {
  const result = await compactSession({
    session,
    models,
    model,
    thinkingLevel: clampSessionThinkingLevel(model, settings),
    customInstructions,
    signal,
  });
  if (!result) throw new Error("Nothing to compact");
  return result;
};

/**
 * Moves the leaf to `entryId`, optionally summarising the branch left behind into a
 * `branch_summary` entry under the new leaf and labelling the target.
 */
export const navigatePiSession = async (
  { session, model, models, signal }: PiSessionOperationOptions,
  entryId: string,
  options: AgentNavigationOptions
): Promise<AgentNavigationResult> => {
  const oldLeafId = await session.getLeafId();
  if (oldLeafId === entryId) return { cancelled: false };
  const target = await session.getEntry(entryId);
  if (!target) throw new Error(`Entry ${entryId} not found`);

  let summary:
    | Pick<BranchSummaryEntry, "summary" | "details" | "usage">
    | undefined;
  if (options.summarize) {
    const entries = await entriesLeftBehind(session, oldLeafId, entryId);
    if (entries.length > 0) {
      const generated = await generateBranchSummary(contextEntries(entries), {
        models,
        model,
        signal: signal ?? new AbortController().signal,
      });
      if (!generated.ok) {
        if (generated.error.code === "aborted") return { cancelled: true };
        throw generated.error;
      }
      summary = {
        summary: generated.value.summary,
        usage: generated.value.usage,
        details: {
          readFiles: generated.value.readFiles,
          modifiedFiles: generated.value.modifiedFiles,
        },
      };
    }
  }

  // The commit point: a cancellation that landed while the summary was generating must not move
  // the leaf or write the summary it was cancelling.
  if (signal?.aborted) return { cancelled: true };

  // Rewinding to a user message re-opens it: the leaf becomes its parent so it can be re-asked.
  const newLeafId =
    target.type === "message" && target.message.role === "user"
      ? target.parentId
      : entryId;
  await session.setLeafId(newLeafId);

  if (summary) {
    const entry: NewSessionEntry<BranchSummaryEntry> = {
      type: "branch_summary",
      id: session.newEntryId(),
      parentId: newLeafId,
      timestamp: Date.now(),
      fromId: newLeafId ?? "root",
      ...summary,
    };
    await session.appendEntry(entry);
  }

  if (options.label) {
    // A label annotates the target; it must not become the leaf the next turn builds on.
    const leafId = await session.getLeafId();
    const entry: NewSessionEntry<LabelEntry> = {
      type: "label",
      id: session.newEntryId(),
      parentId: leafId,
      timestamp: Date.now(),
      targetId: entryId,
      label: options.label,
    };
    await session.appendEntry(entry);
    await session.setLeafId(leafId);
  }

  return { cancelled: false };
};

/**
 * The entries from the old leaf back to its common ancestor with the target, root-first.
 *
 * Walks full parent chains rather than branches: a branch stops at a compaction, and a rewind
 * across one must still find the ancestor the two paths share instead of summarising it too.
 */
const entriesLeftBehind = async (
  session: SessionTree,
  oldLeafId: string | null,
  targetId: string
): Promise<SessionEntry[]> => {
  if (!oldLeafId) return [];
  const byId = new Map(
    (await session.getEntries()).map((entry) => [entry.id, entry])
  );
  const targetAncestors = new Set<string>();
  for (let cursor: string | null = targetId; cursor;) {
    if (targetAncestors.has(cursor)) break;
    targetAncestors.add(cursor);
    cursor = byId.get(cursor)?.parentId ?? null;
  }

  const entries: SessionEntry[] = [];
  for (
    let cursor: string | null = oldLeafId;
    cursor && !targetAncestors.has(cursor);
  ) {
    const entry = byId.get(cursor);
    if (!entry) throw new Error(`Entry ${cursor} not found`);
    entries.push(entry);
    cursor = entry.parentId;
  }
  return entries.reverse();
};
