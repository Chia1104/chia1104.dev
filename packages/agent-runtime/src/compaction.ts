import { randomUUID } from "node:crypto";

import { AgentUsageSource } from "@chia/db/schema";

import { complete } from "./complete.ts";
import type { AgentMessage } from "./messages.ts";
import { contentText } from "./messages.ts";
import type { AgentModel, AgentModelBinding } from "./models.ts";
import { xmlBlock } from "./prompts.ts";
import type {
  CompactionEntry,
  NewSessionEntry,
  SessionEntry,
} from "./session/entries.ts";
import { contextEntries } from "./session/entries.ts";
import type { SessionTree } from "./session/tree.ts";
import {
  estimateBranchContextTokens,
  estimateMessageTokens,
} from "./session/usage.ts";
import type { AgentCompactionResult, AgentUsageListener } from "./types.ts";

/**
 * Condenses the active branch into a summary and a retained tail, appended as a `compaction`
 * entry. The tree keeps every message; only what the model is sent shrinks.
 */

/** Room left for the reply and the next turn's growth before the window is full. */
const RESERVE_TOKENS = 16_384;
/** The newest stretch of the branch kept verbatim after the summary. */
const KEEP_RECENT_TOKENS = 20_000;
/** A summary is structured notes, not a transcript; this bounds what one may cost. */
const SUMMARY_MAX_TOKENS = Math.floor(RESERVE_TOKENS * 0.8);

export const SUMMARIZATION_SYSTEM_PROMPT = `You are a context summarization assistant. Your task is to read a conversation between a user and an AI assistant, then produce a structured summary following the exact format specified.

Do NOT continue the conversation. Do NOT respond to any questions in the conversation. ONLY output the structured summary.`;

const SUMMARY_FORMAT = `## Goal
[What is the user trying to accomplish? Can be multiple items if the session covers different tasks.]

## Constraints & Preferences
- [Any constraints, preferences, or requirements mentioned by user]
- [Or "(none)" if none were mentioned]

## Progress
### Done
- [x] [Completed tasks/changes]

### In Progress
- [ ] [Current work]

### Blocked
- [Issues preventing progress, if any]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Next Steps
1. [Ordered list of what should happen next]

## Critical Context
- [Any data, examples, or references needed to continue]
- [Or "(none)" if not applicable]

Keep each section concise. Preserve exact identifiers, quoted text and error messages.`;

/**
 * Window the compaction threshold is measured against when the summariser is not the session's
 * model: the smaller of the two.
 * The session model's window is what the branch fills; the summariser must still be able to
 * read the whole branch it condenses, so a smaller summariser brings compaction forward.
 */
export const compactionContextWindow = (
  model: Pick<AgentModel, "contextWindow">,
  summariser: Pick<AgentModel, "contextWindow">
): number => Math.min(model.contextWindow, summariser.contextWindow);

/** Whether the active branch has crossed the compaction threshold. */
export const shouldCompactBranch = (
  entries: readonly SessionEntry[],
  contextWindow: number
): boolean => {
  const tokens = estimateBranchContextTokens(entries);
  return tokens > 0 && tokens > contextWindow - RESERVE_TOKENS;
};

interface CompactionPlan {
  previousSummary: string | undefined;
  toSummarize: AgentMessage[];
  retainedTail: AgentMessage[];
  tokensBefore: number;
}

/**
 * Where the branch splits into what the summary replaces and the tail kept verbatim. The tail is
 * the newest `KEEP_RECENT_TOKENS` and starts at a user or assistant message, never at a tool
 * result, which would lose the call it answers. `undefined` when there is nothing to condense:
 * the branch is empty, already ends in a compaction, or fits inside the tail.
 */
const planCompaction = (
  branch: readonly SessionEntry[]
): CompactionPlan | undefined => {
  const entries = contextEntries(branch);
  const last = entries.at(-1);
  if (!last || last.type === "compaction") return undefined;

  const previousIndex = entries.findLastIndex(
    (entry) => entry.type === "compaction"
  );
  const previous = entries[previousIndex];
  const compactable: AgentMessage[] = [
    ...(previous?.type === "compaction" ? previous.retainedTail : []),
    ...entries.slice(previousIndex + 1).flatMap((entry): AgentMessage[] => {
      switch (entry.type) {
        case "message":
          return [entry.message];
        case "branch_summary":
          return [
            {
              role: "user",
              content: `Summary of an abandoned branch: ${entry.summary}`,
              timestamp: entry.timestamp,
            },
          ];
        case "compaction":
          return [];
        default: {
          const _exhaustive: never = entry;
          return _exhaustive;
        }
      }
    }),
  ];

  let kept = 0;
  let cut = compactable.length;
  for (let index = compactable.length - 1; index >= 0; index -= 1) {
    const message = compactable[index];
    if (!message) continue;
    kept += estimateMessageTokens(message);
    if (kept > KEEP_RECENT_TOKENS) break;
    if (message.role !== "toolResult") cut = index;
  }
  if (cut === 0 || cut === compactable.length) return undefined;

  return {
    previousSummary:
      previous?.type === "compaction" ? previous.summary : undefined,
    toSummarize: compactable.slice(0, cut),
    retainedTail: compactable.slice(cut),
    tokensBefore: estimateBranchContextTokens(branch),
  };
};

export const canCompactBranch = (entries: readonly SessionEntry[]): boolean =>
  planCompaction(entries) !== undefined;

/** The conversation as plain text for a summariser, which must read it, not continue it. */
export const serializeConversation = (
  messages: readonly AgentMessage[]
): string =>
  messages
    .flatMap((message) => {
      switch (message.role) {
        case "user":
          return [`[User]: ${contentText(message.content)}`];
        case "assistant": {
          const lines: string[] = [];
          const text = contentText(message.content);
          if (text) lines.push(`[Assistant]: ${text}`);
          for (const part of message.content) {
            if (part.type === "toolCall") {
              lines.push(
                `[Assistant tool call]: ${part.name}(${JSON.stringify(part.arguments)})`
              );
            }
          }
          return lines;
        }
        case "toolResult":
          return [
            `[Tool result${message.isError ? " (error)" : ""}]: ${contentText(message.content)}`,
          ];
        default: {
          const _exhaustive: never = message;
          return _exhaustive;
        }
      }
    })
    .join("\n\n");

/**
 * The summariser's turn: the messages to condense, the summary they update when there is one,
 * and the format to keep.
 */
const summarizationPrompt = (
  plan: CompactionPlan,
  customInstructions: string | undefined
): string =>
  [
    xmlBlock("conversation", serializeConversation(plan.toSummarize)),
    ...(plan.previousSummary
      ? [
          xmlBlock("previous-summary", plan.previousSummary),
          `The messages above are NEW conversation messages to incorporate into the existing summary provided in <previous-summary> tags.

Update the existing structured summary with new information. RULES:
- PRESERVE all existing information from the previous summary
- ADD new progress, decisions, and context from the new messages
- UPDATE the Progress section: move items from "In Progress" to "Done" when completed
- UPDATE "Next Steps" based on what was accomplished
- If something is no longer relevant, you may remove it`,
        ]
      : [
          "The messages above are a conversation to summarize. Create a structured context checkpoint summary that another LLM will use to continue the work.",
        ]),
    `Use this EXACT format:\n\n${SUMMARY_FORMAT}`,
    ...(customInstructions ? [`Additional focus: ${customInstructions}`] : []),
  ].join("\n\n");

export interface CompactSessionOptions {
  session: SessionTree;
  /** The summariser. */
  binding: AgentModelBinding;
  customInstructions?: string;
  signal?: AbortSignal;
  onUsage?: AgentUsageListener;
}

const compactBranch = async (
  branch: readonly SessionEntry[],
  {
    session,
    binding,
    customInstructions,
    signal,
    onUsage,
  }: CompactSessionOptions
): Promise<AgentCompactionResult | null> => {
  const plan = planCompaction(branch);
  if (!plan) return null;

  const completion = await complete({
    binding,
    systemPrompt: SUMMARIZATION_SYSTEM_PROMPT,
    prompt: summarizationPrompt(plan, customInstructions),
    maxTokens: SUMMARY_MAX_TOKENS,
    signal,
  });
  const summary = completion.text.trim();
  const { usage } = completion;
  if (!summary) throw new Error("The summariser returned an empty summary.");

  // Parented under the leaf of the branch that was summarised, not the leaf re-read afterwards:
  // the compaction's ancestors must be exactly what its summary covers.
  const entry: NewSessionEntry<CompactionEntry> = {
    type: "compaction",
    id: randomUUID(),
    parentId: branch.at(-1)?.id ?? null,
    timestamp: Date.now(),
    summary,
    tokensBefore: plan.tokensBefore,
    retainedTail: plan.retainedTail,
    ...(usage && { usage }),
  };
  await session.appendEntry(entry);
  if (usage) {
    await onUsage?.({
      source: AgentUsageSource.Compaction,
      providerId: binding.model.providerId,
      modelId: binding.model.modelId,
      usage,
      entryId: entry.id,
    });
  }

  return { summary, tokensBefore: plan.tokensBefore };
};

/**
 * Summarises the active branch and appends the compaction entry as the new leaf. `null` when
 * there is nothing to condense.
 */
export const compactSession = async (
  options: CompactSessionOptions
): Promise<AgentCompactionResult | null> =>
  compactBranch(await options.session.getBranch(), options);

/** Compacts only when the persisted branch is under context pressure. */
export const compactSessionIfNeeded = async (
  options: CompactSessionOptions,
  contextWindow: number
): Promise<AgentCompactionResult | null> => {
  const branch = await options.session.getBranch();
  if (!shouldCompactBranch(branch, contextWindow)) return null;
  return compactBranch(branch, options);
};
