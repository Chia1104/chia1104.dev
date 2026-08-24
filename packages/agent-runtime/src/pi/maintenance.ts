import { generateBranchSummary } from "@earendil-works/pi-agent-core";
import type { Api, Model, Models } from "@earendil-works/pi-ai";

import type {
  BranchSummaryEntry,
  LabelEntry,
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
}

/** Runs Pi's compaction over the session tree; no tools, prompts or subscriptions are built. */
export const compactPiSession = async (
  { session, settings, model, models }: PiSessionOperationOptions,
  customInstructions?: string
): Promise<AgentCompactionResult> => {
  const result = await compactSession({
    session,
    models,
    model,
    thinkingLevel: clampSessionThinkingLevel(model, settings),
    customInstructions,
  });
  if (!result) throw new Error("Nothing to compact");
  return result;
};

/**
 * Moves the leaf to `entryId`, optionally summarising the branch left behind into a
 * `branch_summary` entry under the new leaf and labelling the target.
 */
export const navigatePiSession = async (
  { session, model, models }: PiSessionOperationOptions,
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
      const generated = await generateBranchSummary(
        /* SAFETY: Context entries carry Pi's entry fields except the storage-assigned `seq`; summarisation reads only messages. */ contextEntries(
          entries
        ) as never,
        { models, model, signal: new AbortController().signal }
      );
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

  // Rewinding to a user message re-opens it: the leaf becomes its parent so it can be re-asked.
  const newLeafId =
    target.type === "message" && target.message.role === "user"
      ? target.parentId
      : entryId;
  await session.setLeafId(newLeafId);

  if (summary) {
    const entry: BranchSummaryEntry = {
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
    const entry: LabelEntry = {
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

/** The entries from the old leaf back to its common ancestor with the target, root-first. */
const entriesLeftBehind = async (
  session: SessionTree,
  oldLeafId: string | null,
  targetId: string
): Promise<SessionEntry[]> => {
  if (!oldLeafId) return [];
  const oldPath = new Set(
    (await session.getBranch(oldLeafId)).map((entry) => entry.id)
  );
  const targetPath = await session.getBranch(targetId);
  let commonAncestorId: string | null = null;
  for (let index = targetPath.length - 1; index >= 0; index -= 1) {
    const id = targetPath[index]?.id;
    if (id && oldPath.has(id)) {
      commonAncestorId = id;
      break;
    }
  }

  const entries: SessionEntry[] = [];
  let current: string | null = oldLeafId;
  while (current && current !== commonAncestorId) {
    const entry = await session.getEntry(current);
    if (!entry) throw new Error(`Entry ${current} not found`);
    entries.push(entry);
    current = entry.parentId;
  }
  return entries.reverse();
};
