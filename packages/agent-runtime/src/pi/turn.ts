import {
  Agent,
  formatPromptTemplateInvocation,
} from "@earendil-works/pi-agent-core";
import type {
  AgentMessage,
  PromptTemplate,
} from "@earendil-works/pi-agent-core";
import type {
  Api,
  AssistantMessage,
  Model,
  Models,
} from "@earendil-works/pi-ai";

import { buildBranchContext } from "../session/context.ts";
import type { MessageEntry, NewSessionEntry } from "../session/entries.ts";
import type { SessionTree } from "../session/tree.ts";
import { bindToolContext, resolveToolContext } from "../tools.ts";
import type { ToolContextSource } from "../tools.ts";
import type {
  AgentAttachment,
  AgentPolicy,
  AgentSessionSettings,
  AgentTool,
  ToolCallRequest,
} from "../types.ts";
import type {
  AgentTurnBudget,
  AgentTurnError,
  AgentTurnExecution,
  AgentTurnMessage,
  AgentUsageListener,
} from "../types.ts";
import type { AgentWireEvent } from "../wire/schema.ts";

import {
  compactionContextWindow,
  compactSessionIfNeeded,
} from "./compaction.ts";
import { errorOfAssistantMessage, errorOfThrown } from "./errors.ts";
import { createPiWireEventMapper } from "./events.ts";
import { clampSessionThinkingLevel } from "./settings.ts";
import { createPiToolCallGate } from "./tool-gate.ts";
import type { ApprovalRequest } from "./tool-gate.ts";
import { createPiTurnBudget } from "./turn-budget.ts";

export interface RunPiTurnOptions<TContext extends object, TApproval> {
  agentSessionId: string;
  session: SessionTree;
  settings: AgentSessionSettings;
  model: Model<Api>;
  /** Must be the same credential-bearing collection that resolved `model`. */
  models: Models;
  /**
   * The model the end-of-turn compaction summarises with; `model` when omitted.
   * A house gateway model is always resolvable on `models`, which is what lets the host pin
   * compaction there.
   */
  compactionModel?: Model<Api>;
  tools: AgentTool<TContext>[];
  toolContext: ToolContextSource<TContext>;
  /**
   * Stable for the life of a session. Heads every provider request, so anything that changes
   * turn to turn belongs in `volatileContext` instead.
   * A changed system prompt invalidates the cached prefix for the system prompt, the tool
   * schemas and the whole transcript behind it.
   */
  systemPrompt: string | (() => string | Promise<string>);
  /**
   * Current state the model should see on every provider request: draft status, clock, anything
   * that would be stale by the next hop.
   * Appended as the last message of the request and never persisted. Undefined omits it.
   */
  volatileContext?: () => string | undefined | Promise<string | undefined>;
  /**
   * Host-owned abort. Firing it aborts the run at once, mid-generation included: Pi cancels the
   * in-flight provider stream and the turn ends as `aborted`.
   * Already-aborted on entry skips the provider entirely.
   */
  signal?: AbortSignal;
  promptTemplates?: readonly PromptTemplate[];
  policy: AgentPolicy;
  /** See {@link AgentTurnBudget}; crossing it ends the turn as `budget_exhausted`. */
  budget: AgentTurnBudget;
  approvedToolCallIds?: ReadonlySet<string>;
  preAuthorizedToolNames?: ReadonlySet<string>;
  message: AgentTurnMessage;
  /**
   * Turns the message's attachments into the text block the model reads ahead of the
   * operator's words, and labels them for clients. Required when a message carries any.
   */
  renderAttachments?: (
    attachments: readonly AgentAttachment[]
  ) => Promise<RenderedAttachments>;
  onEvent: (event: AgentWireEvent) => void;
  toApproval: (request: ApprovalRequest) => TApproval;
  /** Persists the whole batch atomically, or rejects without leaving partial rows. */
  persistApprovals: (approvals: readonly TApproval[]) => Promise<void>;
  flushEvents?: () => Promise<void>;
  /** Every provider call of the turn, its auto-compaction included; see {@link AgentUsageListener}. */
  onUsage?: AgentUsageListener;
}

export interface RenderedAttachments {
  text: string;
  attachments: AgentAttachment[];
}

const volatileMessage = (text: string): AgentMessage => ({
  role: "user",
  content: [{ type: "text", text }],
  timestamp: Date.now(),
});

/** The operator's message as persisted: rendered attachments first, their own words last. */
const attachedPrompt = (rendered: string, text: string): AgentMessage => ({
  role: "user",
  content: [
    { type: "text", text: rendered },
    { type: "text", text },
  ],
  timestamp: Date.now(),
});

/** The text the model receives: the operator's message, or its slash command expanded. */
const promptText = (
  message: AgentTurnMessage,
  templates: readonly PromptTemplate[]
): string => {
  if (!message.template) return message.text;
  const template = templates.find(
    (candidate) => candidate.name === message.template?.name
  );
  if (!template) {
    throw new Error(`Unknown prompt template: ${message.template.name}`);
  }
  return formatPromptTemplateInvocation(template, message.template.args ?? []);
};

/**
 * Executes one complete turn on Pi's `Agent`.
 * The agent is built for this turn only: it receives the branch projected into messages and
 * hands back events. Every finished message is appended to the session tree before the event
 * reaches the wire. Nothing about the run outlives the call.
 */
export const runPiTurn = async <TContext extends object, TApproval>({
  agentSessionId,
  session,
  settings,
  model,
  models,
  compactionModel,
  tools,
  toolContext: toolContextSource,
  systemPrompt: prompt,
  volatileContext,
  signal,
  promptTemplates = [],
  policy,
  budget,
  approvedToolCallIds,
  preAuthorizedToolNames,
  message,
  renderAttachments,
  onEvent,
  toApproval,
  persistApprovals,
  flushEvents,
  onUsage,
}: RunPiTurnOptions<TContext, TApproval>): Promise<
  AgentTurnExecution<TApproval>
> => {
  const unsubscribers: (() => void)[] = [];

  try {
    const systemPrompt = prompt instanceof Function ? await prompt() : prompt;
    const toolContext = await resolveToolContext(toolContextSource);
    const leafId = await session.getLeafId();
    const branch = await session.getBranch(leafId);
    const thinkingLevel = clampSessionThinkingLevel(model, settings);
    const activeTools = settings.activeToolNames
      ? tools.filter((tool) => settings.activeToolNames?.includes(tool.name))
      : tools;

    /**
     * A failure raised by the host inside a Pi hook. Pi turns a throwing hook into a tool error
     * or an assistant message with `stopReason: "error"`, indistinguishable from a provider
     * failure, so hooks catch their own errors here and the turn is failed as `internal` once
     * the run has unwound.
     */
    let hostFailure: AgentTurnError | undefined;
    /** What threw, when the failure came from a throw. Logged beside the failure, never sent. */
    let failureCause: unknown;
    let agent: Agent | undefined;

    /** Ends the turn on a host decision. The run observes its aborted controller and unwinds. */
    const failTurn = (error: AgentTurnError, cause?: unknown) => {
      if (!hostFailure) {
        hostFailure = error;
        failureCause = cause;
      }
      agent?.abort();
    };

    const gate = createPiToolCallGate({
      policy,
      autoApprove: settings.autoApprove,
      approvedToolCallIds,
      preAuthorizedToolNames,
      // Announced at once so the approval card replaces the tool card while the model is still
      // writing its hand-back.
      onRequest: (request) =>
        onEvent({
          type: "approval:request",
          toolCallId: request.toolCallId,
          toolName: request.toolName,
          tier: request.tier,
          args: request.args,
        }),
    });
    const turnBudget = createPiTurnBudget({
      budget,
      onExhausted: () =>
        failTurn({
          kind: "budget_exhausted",
          message: `The model issued more than ${budget.hardMaxToolCalls} tool calls in one turn.`,
        }),
    });

    /**
     * Bounds the model's generation only. Cleared as soon as the reply resolves, so it can
     * never fail a turn whose model has already stopped. Approval persistence and compaction
     * that follow are host work.
     */
    const deadline = setTimeout(
      () =>
        failTurn({
          kind: "budget_exhausted",
          message: `The turn ran longer than ${Math.round(budget.maxDurationMs / 1000)}s.`,
        }),
      budget.maxDurationMs
    );
    unsubscribers.push(() => clearTimeout(deadline));

    /**
     * Rendered before the model runs and persisted with the user message, so the transcript
     * carries what the model was shown. A render failure fails the turn as `internal`: the
     * model must not act on a message whose attachments it cannot see.
     */
    let rendered: RenderedAttachments | undefined;
    if (message.attachments && message.attachments.length > 0) {
      try {
        if (!renderAttachments) {
          throw new Error("This agent kind does not accept attachments.");
        }
        rendered = await renderAttachments(message.attachments);
      } catch (error) {
        failTurn(
          {
            kind: "internal",
            message: "The message's attachments could not be rendered.",
          },
          error
        );
      }
    }

    let revision = 0;
    agent = new Agent({
      initialState: {
        systemPrompt,
        model,
        thinkingLevel,
        tools: bindToolContext(activeTools, toolContext),
        messages: buildBranchContext(branch),
      },
      // Bound to this turn's collection rather than a process-wide default: the collection
      // carries the operator's own credentials, and a default would let a BYOK turn fall back
      // to ambient keys.
      streamFn: (requestModel, context, options) =>
        models.streamSimple(requestModel, context, options),
      transformContext: volatileContext
        ? async (messages) => {
            try {
              const text = await volatileContext();
              return text ? [...messages, volatileMessage(text)] : messages;
            } catch (error) {
              // Fail closed: a model that cannot see the current state must not act on it.
              failTurn(errorOfThrown(error));
              return messages;
            }
          }
        : undefined,
      // One hook, budget first: a call the budget refuses must never raise an approval.
      beforeToolCall: async ({ toolCall, args }) => {
        const request: ToolCallRequest = {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          input: args,
        };
        try {
          return turnBudget.handle(request) ?? gate.handle(request);
        } catch (error) {
          failTurn(errorOfThrown(error));
          return { block: true, reason: "This turn is being stopped." };
        }
      },
      afterToolCall: policy.changesState
        ? async ({ toolCall, isError }) => {
            if (
              !isError &&
              policy.changesState?.(policy.tierOf(toolCall.name))
            ) {
              revision += 1;
              onEvent({
                type: "state:changed",
                scope: policy.stateScope,
                revision,
              });
            }
            return undefined;
          }
        : undefined,
    });

    /**
     * Entry ids are reserved when a message starts and spent when it ends, so the wire names a
     * message by the id the tree persists it under. Live and replayed transcripts then agree,
     * and a client can hand any message id back as a rewind or fork target.
     * The operator's prompt is reserved up front: its `user` event goes out before Pi has
     * started the message.
     */
    const userEntryId = session.newEntryId();
    let reservedEntryId: string | undefined = userEntryId;
    const mapEvent = createPiWireEventMapper({
      messageIdOf: () => {
        reservedEntryId ??= session.newEntryId();
        return reservedEntryId;
      },
      tierOf: policy.tierOf,
      labelOf: policy.labelOf,
      summarize: policy.summarize,
    });
    let cursor = leafId;
    let reply: AssistantMessage | undefined;
    /**
     * Set once the tree refused a message. Nothing after that is persisted or shown: the run is
     * being aborted, and what Pi still emits on its way out would hang off a lost parent.
     */
    let treeFailed = false;
    unsubscribers.push(
      agent.subscribe(async (event) => {
        if (treeFailed) return;
        if (event.type === "message_end") {
          // Persisted before it reaches the wire, so a client never sees a message the tree
          // lost.
          const entry: NewSessionEntry<MessageEntry> = {
            type: "message",
            id: reservedEntryId ?? session.newEntryId(),
            parentId: cursor,
            timestamp: Date.now(),
            message: event.message,
          };
          if (rendered && event.message.role === "user") {
            entry.attachments = rendered.attachments;
          }
          reservedEntryId = undefined;
          try {
            await session.appendEntry(entry);
          } catch (error) {
            // Thrown out of here, Pi would resolve the run as a provider error and persist
            // that.
            treeFailed = true;
            failTurn(
              {
                kind: "internal",
                message: `The session tree refused entry ${entry.id}.`,
              },
              error
            );
            return;
          }
          cursor = entry.id;
          if (event.message.role === "assistant") {
            reply = event.message;
            // Reported by what the provider says answered, not what was asked for: the two
            // differ when a gateway routes a request, and the bill follows the provider.
            await onUsage?.({
              source: "turn",
              providerId: event.message.provider,
              modelId: event.message.model,
              usage: event.message.usage,
              entryId: entry.id,
            });
          }
        }
        for (const wireEvent of mapEvent(event)) onEvent(wireEvent);
      })
    );

    if (signal) {
      const abortRun = () => agent?.abort();
      signal.addEventListener("abort", abortRun, { once: true });
      unsubscribers.push(() => signal.removeEventListener("abort", abortRun));
    }

    onEvent({ type: "run:start", sessionId: agentSessionId });
    if (message.decision) {
      // The decision was persisted by the host before this turn was woken, so announcing it
      // here is a replay of fact, not a new state; it closes the approval card on the live
      // view.
      onEvent({
        type: "approval:resolved",
        toolCallId: message.decision.toolCallId,
        approved: message.decision.approved,
        comment: message.decision.comment,
      });
    }
    onEvent({
      type: "user",
      messageId: userEntryId,
      text: message.text,
      attachments: rendered?.attachments,
      at: Date.now(),
      origin: message.decision ? "operator-decision" : undefined,
    });

    let failure: AgentTurnError | undefined;
    // Checked right before the run arms its controller: an abort that fired earlier would find
    // no run to cancel, and one that fires later is delivered by the listener above.
    let aborted = signal?.aborted ?? false;
    if (!aborted) {
      try {
        const text = promptText(message, promptTemplates);
        // A host failure raised before the run (unrenderable attachments) skips the model.
        if (!hostFailure) {
          await (rendered
            ? agent.prompt(attachedPrompt(rendered.text, text))
            : agent.prompt(text));
        }
        // Pi resolves provider failures as an assistant message rather than throwing: `error`
        // carries the provider's text (post-retry), `aborted` means the run's controller fired.
        if (hostFailure) failure = hostFailure;
        else if (!reply) {
          failure = {
            kind: "internal",
            message: "The turn completed without an assistant message.",
          };
        } else if (reply.stopReason === "aborted") aborted = true;
        else if (reply.stopReason === "error") {
          failure = errorOfAssistantMessage(reply, model.contextWindow);
        }
      } catch (error) {
        failure = hostFailure ?? errorOfThrown(error);
        failureCause ??= error;
      }
    }
    clearTimeout(deadline);
    // An abort that lands after the reply resolved must still keep the turn from persisting
    // approvals or compacting: the run is being cancelled, and rows written now would outlive
    // it.
    if (!failure && signal?.aborted) aborted = true;

    let approvals: TApproval[] = [];
    if (!failure && !aborted && gate.requests.length > 0) {
      try {
        const pending = gate.requests.map(toApproval);
        await persistApprovals(pending);
        approvals = pending;
      } catch (error) {
        failure = errorOfThrown(error);
        failureCause = error;
      }
    }

    if (!failure && !aborted && approvals.length === 0) {
      try {
        const summariser = compactionModel ?? model;
        const compacted = await compactSessionIfNeeded(
          {
            session,
            models,
            model: summariser,
            thinkingLevel: clampSessionThinkingLevel(summariser, settings),
            onUsage,
          },
          compactionContextWindow(model, summariser)
        );
        if (compacted) onEvent({ type: "session:compacted", ...compacted });
      } catch {
        // The next clean turn boundary retries compaction.
      }
    }

    if (failure) {
      // The wire carries the kind alone; the detail and what threw stay in the log.
      console.error("Agent turn failed", {
        sessionId: agentSessionId,
        kind: failure.kind,
        message: failure.message,
        cause: failureCause,
      });
      onEvent({ type: "error", kind: failure.kind });
    }

    const status: AgentTurnExecution<TApproval>["status"] = failure
      ? "error"
      : aborted
        ? "aborted"
        : approvals.length > 0
          ? "awaiting_approval"
          : "done";

    onEvent({ type: "run:end", reason: status });

    return { status, approvals, error: failure };
  } finally {
    try {
      for (const unsubscribe of unsubscribers) unsubscribe();
    } finally {
      await flushEvents?.();
    }
  }
};
