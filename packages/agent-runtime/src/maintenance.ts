import { randomUUID } from "node:crypto";

import { AgentUsageSource } from "@chia/db/schema";

import {
  serializeConversation,
  SUMMARIZATION_SYSTEM_PROMPT,
} from "./compaction.ts";
import { complete, CompletionError } from "./complete.ts";
import type { AgentMessage } from "./messages.ts";
import type { AgentModelBinding } from "./models.ts";
import { xmlBlock } from "./prompts.ts";
import type {
  BranchSummaryEntry,
  NewSessionEntry,
  SessionEntry,
} from "./session/entries.ts";
import type { SessionTree } from "./session/tree.ts";
import { estimateMessageTokens } from "./session/usage.ts";
import type {
  AgentNavigationOptions,
  AgentNavigationResult,
  AgentUsageListener,
} from "./types.ts";

/** Navigation over the session tree; no tools, prompts or engine run. */

export interface SessionOperationOptions {
  session: SessionTree;
  /** The summariser. */
  binding: AgentModelBinding;
  /** Cancels the summary request; the tree is untouched when it fires. */
  signal?: AbortSignal;
  onUsage?: AgentUsageListener;
}

const BRANCH_SUMMARY_PROMPT = `Create a structured summary of this conversation branch for context when returning later.

Use this EXACT format:

## Goal
[What was the user trying to accomplish in this branch?]

## Constraints & Preferences
- [Any constraints, preferences, or requirements mentioned]
- [Or "(none)" if none were mentioned]

## Progress
### Done
- [x] [Completed tasks/changes]

### In Progress
- [ ] [Work that was started but not finished]

### Blocked
- [Issues preventing progress, if any]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Next Steps
1. [What should happen next to continue this work]

Keep each section concise. Preserve exact identifiers, quoted text and error messages.`;

const BRANCH_SUMMARY_MAX_TOKENS = 2048;

/** Room kept free of the summariser's window for its prompt and reply. */
const BRANCH_SUMMARY_RESERVE_TOKENS = 16_384;

/** The newest messages left behind that fit the summariser's window, oldest first. */
const branchMessages = (
  entries: readonly SessionEntry[],
  budget: number
): AgentMessage[] => {
  const messages: AgentMessage[] = [];
  let total = 0;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    const message =
      entry?.type === "message"
        ? entry.message
        : entry?.type === "branch_summary" || entry?.type === "compaction"
          ? ({
              role: "user",
              content: entry.summary,
              timestamp: entry.timestamp,
            } satisfies AgentMessage)
          : undefined;
    if (!message) continue;
    total += estimateMessageTokens(message);
    if (total > budget && messages.length > 0) break;
    messages.push(message);
  }
  return messages.reverse();
};

/**
 * Moves the leaf to `entryId`, optionally summarising the branch left behind into a
 * `branch_summary` entry under the new leaf.
 */
export const navigateSession = async (
  { session, binding, signal, onUsage }: SessionOperationOptions,
  entryId: string,
  options: AgentNavigationOptions
): Promise<AgentNavigationResult> => {
  const oldLeafId = await session.getLeafId();
  if (oldLeafId === entryId) return { cancelled: false };
  const target = await session.getEntry(entryId);
  if (!target) throw new Error(`Entry ${entryId} not found`);

  let summary: Pick<BranchSummaryEntry, "summary" | "usage"> | undefined;
  if (options.summarize) {
    const entries = await entriesLeftBehind(session, oldLeafId, entryId);
    if (entries.length > 0) {
      const messages = branchMessages(
        entries,
        binding.model.contextWindow - BRANCH_SUMMARY_RESERVE_TOKENS
      );
      try {
        const completion = await complete({
          binding,
          systemPrompt: SUMMARIZATION_SYSTEM_PROMPT,
          prompt: `${xmlBlock("conversation", serializeConversation(messages))}\n\n${BRANCH_SUMMARY_PROMPT}`,
          maxTokens: BRANCH_SUMMARY_MAX_TOKENS,
          signal,
        });
        summary = {
          summary: `The user explored a different conversation branch before returning here.\nSummary of that exploration:\n\n${completion.text.trim() || "No summary generated"}`,
          usage: completion.usage,
        };
      } catch (error) {
        if (error instanceof CompletionError && error.aborted) {
          return { cancelled: true };
        }
        throw error;
      }
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
      id: randomUUID(),
      parentId: newLeafId,
      timestamp: Date.now(),
      fromId: newLeafId,
      ...summary,
    };
    await session.appendEntry(entry);
    if (summary.usage) {
      await onUsage?.({
        source: AgentUsageSource.BranchSummary,
        providerId: binding.model.providerId,
        modelId: binding.model.modelId,
        usage: summary.usage,
        entryId: entry.id,
      });
    }
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
