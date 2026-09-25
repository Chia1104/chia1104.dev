import { randomUUID } from "node:crypto";

import { chat, toolDefinition } from "@tanstack/ai";
import type {
  ChatMiddleware,
  ModelMessage,
  RunAgentResumeItem,
  StreamChunk,
  TokenUsage,
} from "@tanstack/ai";
import * as z from "zod";

import { AgentUsageSource } from "@chia/db/schema";
import { logger } from "@chia/observability/logger";
import { reportError } from "@chia/observability/report";
import { isAbortError } from "@chia/utils/error-helper";
import { asJsonObject, asJsonValue, stableStringify } from "@chia/utils/json";

import {
  compactionContextWindow,
  compactSessionIfNeeded,
} from "./compaction.ts";
import { errorOfProviderMessage, errorOfThrown } from "./errors.ts";
import type {
  AssistantMessage,
  TextContent,
  ThinkingContent,
  ToolCallContent,
  ToolResultMessage,
  UserMessage,
} from "./messages.ts";
import { emptyUsage, StopReason } from "./messages.ts";
import type { AgentModelBinding } from "./models.ts";
import { tokenUsageOf, usageOf } from "./models.ts";
import type { PromptTemplate } from "./prompts.ts";
import { formatPromptTemplateInvocation } from "./prompts.ts";
import { buildBranchContext } from "./session/context.ts";
import type {
  MessageEntry,
  NewSessionEntry,
  SessionEntry,
} from "./session/entries.ts";
import type { SessionTree } from "./session/tree.ts";
import { modelSpans, traceAgentTurn, traceToolCall } from "./telemetry.ts";
import type { AgentTool, ToolResult } from "./tools.ts";
import { createTurnBudget } from "./turn-budget.ts";
import { AgentErrorKind } from "./types.ts";
import type {
  AgentPolicy,
  AgentSessionSettings,
  AgentTurnBudget,
  AgentTurnError,
  AgentTurnExecution,
  AgentTurnMessage,
  AgentTurnResume,
  AgentUsageListener,
  ApprovalDecision,
  ApprovalRequest,
  ToolCallRefusal,
  ToolCallRequest,
} from "./types.ts";
import {
  assistantEndEvent,
  toolEndEvent,
  toolStartEvent,
} from "./wire/replay.ts";
import type { AgentAttachment, AgentWireEvent } from "./wire/schema.ts";

/**
 * A gated call the turn answered itself: approved because the session pre-approved its tier, or
 * refused by the turn's own checks with `reason`.
 */
export interface SettledCall {
  toolCallId: string;
  toolName: string;
  args: unknown;
  key: string;
  approved: boolean;
  reason?: string;
}

/**
 * The gated calls a turn stopped on. The operator answers `requests`; `settled` calls ride along,
 * because the engine resumes a batch only once every call in it is answered.
 */
export interface ApprovalBatch {
  requests: ApprovalRequest[];
  settled: SettledCall[];
}

export interface RunTurnBase {
  agentSessionId: string;
  /** The durable run this turn belongs to; names the engine run and is logged beside failures. */
  agentRunId: string;
  session: SessionTree;
  settings: AgentSessionSettings;
  /** The session's model, bound to the caller's credentials. */
  binding: AgentModelBinding;
  /**
   * What the end-of-turn compaction summarises with; the turn's own binding when omitted. A
   * compaction pinned to a house model runs on the house key, so the caller's keys never pay for it.
   */
  compaction?: AgentModelBinding;
  /** Closed over this turn's ports; the order is the order the model sees them. */
  tools: AgentTool[];
  /**
   * Stable for the life of a session. Heads every provider request, so anything that changes
   * turn to turn belongs in `volatileContext` instead.
   * A changed system prompt invalidates the cached prefix for the system prompt, the tool
   * schemas and the whole transcript behind it.
   */
  systemPrompt: string;
  /**
   * Current state the model should see on every provider request: draft status, clock, anything
   * that would be stale by the next hop.
   * Appended as the last message of the request and never persisted. Undefined omits it.
   */
  volatileContext?: () => string | undefined | Promise<string | undefined>;
  /**
   * Host-owned abort. Firing it aborts the turn at once, mid-generation included, and the turn
   * ends as `aborted`. Already-aborted on entry skips the provider entirely.
   */
  signal?: AbortSignal;
  promptTemplates?: readonly PromptTemplate[];
  policy: AgentPolicy;
  /** See {@link AgentTurnBudget}; crossing it ends the turn as `budget_exhausted`. */
  budget: AgentTurnBudget;
  /**
   * Kind-specific checks a call must pass before it runs or reaches the operator, so a call that
   * would fail anyway never raises an approval. Runs after the budget; a refusal reads like a
   * tool error.
   */
  preflight?: (
    request: ToolCallRequest
  ) => Promise<ToolCallRefusal | undefined> | ToolCallRefusal | undefined;
  /**
   * What an approval request is recorded as: the tool, its target and the state the operator is
   * shown. Defaults to the tool name and its exact arguments.
   */
  approvalKeyOf?: (request: ToolCallRequest) => string | Promise<string>;
  /**
   * Turns the message's attachments into the text block the model reads ahead of the
   * operator's words, and labels them for clients. Required when a message carries any.
   */
  renderAttachments?: (
    attachments: readonly AgentAttachment[]
  ) => Promise<RenderedAttachments>;
  /**
   * Grades a typed message before the model runs. A refusal ends the turn as `refused` and the
   * message is never persisted, so it cannot steer a later turn from the transcript.
   */
  screen?: (
    message: AgentTurnMessage,
    signal?: AbortSignal
  ) => Promise<MessageRefusal | undefined>;
  onEvent: (event: AgentWireEvent) => void;
  /** Records the calls a turn stopped on, or rejects without leaving a row. */
  persistApprovals: (batch: ApprovalBatch) => Promise<void>;
  flushEvents?: () => Promise<void>;
  /** Every provider call of the turn, its auto-compaction included; see {@link AgentUsageListener}. */
  onUsage?: AgentUsageListener;
}

/** A turn starts from the operator's message, or resumes the calls an earlier turn stopped on. */
export type AgentTurnInput =
  | { message: AgentTurnMessage; resume?: never }
  | { resume: AgentTurnResume; message?: never };

export type RunTurnOptions = RunTurnBase & AgentTurnInput;

/** What a kind contributes to a turn; the host supplies the session, model, events and approvals. */
export type AgentTurnPlan = Pick<
  RunTurnBase,
  | "tools"
  | "systemPrompt"
  | "volatileContext"
  | "promptTemplates"
  | "budget"
  | "preflight"
  | "approvalKeyOf"
  | "renderAttachments"
  | "screen"
>;

/** Why a kind's `screen` turned a message away; logged, never sent. */
export interface MessageRefusal {
  reason: string;
}

export interface RenderedAttachments {
  text: string;
  attachments: AgentAttachment[];
}

/**
 * The tool and its exact arguments: an approval request is recorded as that call and nothing else.
 * Arguments that are not JSON have no stable identity, so such a request names only its call.
 */
export const defaultApprovalKey = (request: ToolCallRequest): string => {
  const input = asJsonValue(request.input ?? null);
  return `${request.toolName}:${input === undefined ? request.toolCallId : stableStringify(input)}`;
};

/** The id the engine gives the approval interrupt of a gated call. */
const approvalInterruptId = (toolCallId: string) => `approval_${toolCallId}`;

/** What the model reads for a call it may not run. */
const refusalText = (decision: ApprovalDecision): string =>
  decision.refused
    ? (decision.comment ?? "The call was refused.")
    : decision.comment
      ? `The operator declined this call: ${decision.comment}`
      : "The operator declined this call.";

const resumeItemOf = (decision: ApprovalDecision): RunAgentResumeItem => ({
  interruptId: approvalInterruptId(decision.toolCallId),
  status: "resolved",
  payload: decision.approved
    ? { approved: true }
    : { approved: false, payload: { error: refusalText(decision) } },
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
 * The operator's message as persisted: rendered attachments first, their own words last.
 * Readers of the transcript (lesson extraction) rely on the block being content part 0.
 */
const userMessageOf = (
  text: string,
  rendered: RenderedAttachments | undefined
): UserMessage => ({
  role: "user",
  content: rendered
    ? [
        { type: "text", text: rendered.text },
        { type: "text", text },
      ]
    : text,
  timestamp: Date.now(),
});

const stopReasonOf = (finishReason: string | null | undefined): StopReason =>
  finishReason === "tool_calls"
    ? StopReason.ToolUse
    : finishReason === "length"
      ? StopReason.Length
      : StopReason.Stop;

const reasoningItemSchema = z.object({ id: z.string() }).loose();

/**
 * Which reasoning item a signature belongs to: the item id an OpenAI-shaped signature carries, or
 * the signature itself.
 */
const reasoningIdentity = (signature: string): string => {
  try {
    return (
      reasoningItemSchema.safeParse(JSON.parse(signature)).data?.id ?? signature
    );
  } catch {
    return signature;
  }
};

/** Fields the adapters put on `STEP_FINISHED` beside the AG-UI ones. */
const stepFinishedSchema = z
  .object({ signature: z.string().optional(), content: z.string().optional() })
  .loose();

const failedCallSchema = z.object({ error: z.string() }).loose();

/** The engine's text for a failed call is `{"error": ...}`; the model and the transcript read the message. */
const failedCallText = (content: string): string => {
  try {
    const parsed = failedCallSchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data.error : content;
  } catch {
    return content;
  }
};

/** A reply being streamed; becomes an `AssistantMessage` when its model call ends. */
interface ReplyDraft {
  entryId: string;
  parts: (TextContent | ThinkingContent | ToolCallContent)[];
  text: TextContent | undefined;
  thinking: ThinkingContent | undefined;
  args: Map<string, { part: ToolCallContent; buffer: string }>;
}

/** Every tool call the branch's replies made, by id. */
const callsOf = (
  branch: readonly SessionEntry[]
): Map<string, ToolCallContent> =>
  new Map(
    branch.flatMap((entry) =>
      entry.type === "message" && entry.message.role === "assistant"
        ? entry.message.content.flatMap((part) =>
            part.type === "toolCall" ? [[part.id, part] as const] : []
          )
        : []
    )
  );

type ChatResult =
  | { status: "done" }
  | { status: "aborted" }
  | { status: "error"; error: AgentTurnError; cause?: unknown }
  | { status: "interrupted"; toolCallIds: string[] };

const executeTurn = async (
  options: RunTurnOptions
): Promise<AgentTurnExecution> => {
  const {
    agentSessionId,
    agentRunId,
    session,
    settings,
    binding,
    compaction,
    tools,
    systemPrompt,
    volatileContext,
    signal,
    promptTemplates = [],
    policy,
    budget,
    preflight,
    approvalKeyOf = defaultApprovalKey,
    renderAttachments,
    screen,
    onEvent,
    persistApprovals,
    flushEvents,
    onUsage,
  } = options;
  const cleanups: (() => void)[] = [];

  try {
    const controller = new AbortController();
    /**
     * A failure the host raised while the engine ran. The engine turns a throwing hook into a
     * tool error or a provider error, indistinguishable from the real thing, so hooks catch their
     * own errors here and the turn is failed as `internal` once the run has unwound.
     */
    let hostFailure: AgentTurnError | undefined;
    /** What threw, when the failure came from a throw. Logged beside the failure, never sent. */
    let failureCause: unknown;
    const failTurn = (error: AgentTurnError, cause?: unknown) => {
      if (!hostFailure) {
        hostFailure = error;
        failureCause = cause;
      }
      controller.abort();
    };

    let aborted = false;
    if (signal) {
      const abortTurn = () => {
        aborted = true;
        controller.abort();
      };
      if (signal.aborted) abortTurn();
      else {
        signal.addEventListener("abort", abortTurn, { once: true });
        cleanups.push(() => signal.removeEventListener("abort", abortTurn));
      }
    }

    const turnBudget = createTurnBudget({
      budget,
      onExhausted: () =>
        failTurn({
          kind: AgentErrorKind.BudgetExhausted,
          message: `The model issued more than ${budget.hardMaxToolCalls} tool calls in one turn.`,
        }),
    });

    /**
     * Bounds the model's generation only. Cleared as soon as the engine is done, so it can never
     * fail a turn whose model has already stopped. Approval bookkeeping and compaction that
     * follow are host work.
     */
    const deadline = setTimeout(
      () =>
        failTurn({
          kind: AgentErrorKind.BudgetExhausted,
          message: `The turn ran longer than ${Math.round(budget.maxDurationMs / 1000)}s.`,
        }),
      budget.maxDurationMs
    );
    cleanups.push(() => clearTimeout(deadline));

    const { message, resume } = options;

    /**
     * Rendered before the model runs and persisted with the user message, so the transcript
     * carries what the model was shown. A render failure fails the turn as `internal`: the
     * model must not act on a message whose attachments it cannot see.
     */
    let rendered: RenderedAttachments | undefined;
    if (message?.attachments && message.attachments.length > 0) {
      try {
        if (!renderAttachments) {
          throw new Error("This agent kind does not accept attachments.");
        }
        rendered = await renderAttachments(message.attachments);
      } catch (error) {
        failTurn(
          {
            kind: AgentErrorKind.Internal,
            message: "The message's attachments could not be rendered.",
          },
          error
        );
      }
    }

    if (message && screen && !hostFailure) {
      try {
        const refusal = await screen(message, signal);
        if (refusal) {
          failTurn({ kind: AgentErrorKind.Refused, message: refusal.reason });
        }
      } catch (error) {
        failTurn(errorOfThrown(error), error);
      }
    }

    onEvent({ type: "run:start", sessionId: agentSessionId });

    let cursor = await session.getLeafId();
    /** Set once the tree refused an entry: nothing after it may be persisted or shown. */
    let treeFailed = false;
    const append = async (entry: NewSessionEntry): Promise<boolean> => {
      if (treeFailed) return false;
      try {
        await session.appendEntry(entry);
        cursor = entry.id;
        return true;
      } catch (error) {
        treeFailed = true;
        failTurn(
          {
            kind: AgentErrorKind.Internal,
            message: `The session tree refused entry ${entry.id}.`,
          },
          error
        );
        return false;
      }
    };

    if (resume) {
      // The decisions were persisted before this turn started; announcing them closes the
      // approval cards on a live view.
      for (const decision of resume.decisions) {
        onEvent({
          type: "approval:resolved",
          toolCallId: decision.toolCallId,
          approved: decision.approved,
          comment: decision.comment,
        });
      }
    } else if (message) {
      const userEntryId = randomUUID();
      onEvent({
        type: "user",
        messageId: userEntryId,
        text: message.text,
        attachments: rendered?.attachments,
        at: Date.now(),
      });
      // A failure raised before the model (unrenderable attachments, a refused message) keeps
      // the message out of the tree.
      if (!hostFailure && !aborted) {
        let text: string | undefined;
        try {
          text = promptText(message, promptTemplates);
        } catch (error) {
          failTurn(errorOfThrown(error), error);
        }
        if (text !== undefined) {
          const entry: NewSessionEntry<MessageEntry> = {
            type: "message",
            id: userEntryId,
            parentId: cursor,
            timestamp: Date.now(),
            message: userMessageOf(text, rendered),
            ...(rendered && { attachments: rendered.attachments }),
          };
          await append(entry);
        }
      }
    }

    /** Calls the operator declined, answered on this resume; the transcript records it. */
    const declined = new Map(
      (resume?.decisions ?? []).flatMap((decision) =>
        !decision.approved && !decision.refused
          ? [[decision.toolCallId, decision.comment] as const]
          : []
      )
    );
    const toolNames = new Map<string, string>();
    const toolResults = new Map<string, ToolResult>();
    /** Gated calls this turn already checked before answering them; they are not counted twice. */
    const checkedCalls = new Set<string>();
    let stateRevision = 0;
    /** Calls the turn's own checks answered in place of the tool; they read as errors. */
    const refusedCalls = new Map<string, string>();

    /** The checks every call passes, gated or not, before it runs or reaches the operator. */
    const checkCall = async (
      request: ToolCallRequest
    ): Promise<ToolCallRefusal | undefined> =>
      turnBudget.handle(request) ?? (await preflight?.(request));

    const activeTools = settings.activeToolNames
      ? tools.filter((tool) => settings.activeToolNames?.includes(tool.name))
      : tools;
    const engineTools = activeTools.map((tool) => {
      const { tier } = policy.toolInfo(tool.name);
      return toolDefinition({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters,
        // Gated by tier alone: a resumed turn rebuilds its pending calls from this flag, so the
        // session's auto-approval, which may change while a call waits, is applied per call.
        needsApproval: policy.requiresApproval(tier),
      }).server(async (input, context) => {
        const toolCallId = context?.toolCallId ?? "";
        try {
          const result = await traceToolCall(tool.name, toolCallId, () =>
            tool.execute(input, { toolCallId, signal: context?.abortSignal })
          );
          toolResults.set(toolCallId, result);
          return result.text;
        } catch (error) {
          // The engine hands the throw to the model as an error result; the log is the only
          // record of what threw, and the model's input is as likely the cause as ours.
          logger.warn(
            {
              err: error,
              sessionId: agentSessionId,
              runId: agentRunId,
              tool: tool.name,
              toolCallId,
            },
            "Tool call failed"
          );
          throw error;
        }
      });
    });

    /** One engine run over the branch below `cursor`. */
    const runChat = async (request: {
      messages: ModelMessage[];
      runId: string;
      parentRunId?: string;
      resume?: RunAgentResumeItem[];
    }): Promise<ChatResult> => {
      let reply: ReplyDraft | undefined;
      let providerError: string | undefined;
      let interrupted: string[] | undefined;
      let finished = false;

      const persistReply = async (
        stopReason: StopReason,
        usage: TokenUsage | undefined,
        errorMessage?: string
      ) => {
        const draft = reply;
        reply = undefined;
        if (!draft) return;
        for (const [, call] of draft.args) {
          if (Object.keys(call.part.arguments).length > 0) continue;
          try {
            call.part.arguments =
              asJsonObject(JSON.parse(call.buffer || "{}")) ?? {};
          } catch {
            call.part.arguments = {};
          }
        }
        const assistant: AssistantMessage = {
          role: "assistant",
          // A repeated reasoning item leaves an empty part with nothing to send back.
          content: draft.parts.filter(
            (part) =>
              part.type !== "thinking" ||
              part.thinking.length > 0 ||
              part.thinkingSignature !== undefined
          ),
          api: binding.api,
          provider: binding.model.providerId,
          model: binding.model.modelId,
          usage: usage ? usageOf(binding, usage) : emptyUsage(),
          stopReason,
          ...(errorMessage !== undefined && { errorMessage }),
          timestamp: Date.now(),
        };
        const entry: NewSessionEntry<MessageEntry> = {
          type: "message",
          id: draft.entryId,
          parentId: cursor,
          timestamp: assistant.timestamp,
          message: assistant,
        };
        // Persisted before it reaches the wire, so a client never sees a message the tree lost.
        if (!(await append(entry))) return;
        onEvent(assistantEndEvent(entry.id, assistant));
        if (usage) {
          await onUsage?.({
            source: AgentUsageSource.Turn,
            providerId: assistant.provider,
            modelId: assistant.model,
            usage: assistant.usage,
            entryId: entry.id,
          });
        }
        // An unfinished reply's calls never run; the live view shows no card for them either.
        if (
          stopReason !== StopReason.Error &&
          stopReason !== StopReason.Aborted
        ) {
          for (const part of draft.parts) {
            if (part.type !== "toolCall") continue;
            onEvent(
              toolStartEvent(
                {
                  toolCallId: part.id,
                  toolName: part.name,
                  args: part.arguments,
                },
                policy
              )
            );
          }
        }
      };

      const handleChunk = async (chunk: StreamChunk): Promise<void> => {
        if (treeFailed) return;
        switch (chunk.type) {
          case "TEXT_MESSAGE_CONTENT": {
            if (!reply) return;
            if (!reply.text) {
              reply.text = { type: "text", text: "" };
              reply.parts.push(reply.text);
            }
            reply.text.text += chunk.delta;
            onEvent({
              type: "assistant:delta",
              messageId: reply.entryId,
              channel: "text",
              delta: chunk.delta,
            });
            return;
          }
          case "REASONING_MESSAGE_START": {
            if (!reply) return;
            reply.thinking = { type: "thinking", thinking: "" };
            reply.parts.push(reply.thinking);
            reply.text = undefined;
            return;
          }
          case "REASONING_MESSAGE_CONTENT": {
            if (!reply) return;
            if (!reply.thinking) {
              reply.thinking = { type: "thinking", thinking: "" };
              reply.parts.push(reply.thinking);
            }
            reply.thinking.thinking += chunk.delta;
            onEvent({
              type: "assistant:delta",
              messageId: reply.entryId,
              channel: "thinking",
              delta: chunk.delta,
            });
            return;
          }
          case "STEP_FINISHED":
          case "REASONING_ENCRYPTED_VALUE": {
            if (!reply) return;
            const signature =
              chunk.type === "REASONING_ENCRYPTED_VALUE"
                ? chunk.subtype === "message"
                  ? chunk.encryptedValue
                  : undefined
                : stepFinishedSchema.safeParse(chunk).data?.signature;
            if (!signature) return;
            // A provider may repeat a reasoning item; the wire takes each one back exactly once,
            // with the signature it sent last.
            const identity = reasoningIdentity(signature);
            const earlier = reply.parts.find(
              (part): part is ThinkingContent =>
                part.type === "thinking" &&
                part.thinkingSignature !== undefined &&
                reasoningIdentity(part.thinkingSignature) === identity
            );
            if (earlier) {
              earlier.thinkingSignature = signature;
              const repeat = reply.thinking;
              if (repeat && repeat !== earlier) {
                reply.parts = reply.parts.filter((part) => part !== repeat);
              }
              reply.thinking = undefined;
              return;
            }
            // A reasoning item may carry only its signature, with no summary text streamed.
            const thinking =
              reply.thinking && reply.thinking.thinkingSignature === undefined
                ? reply.thinking
                : { type: "thinking" as const, thinking: "" };
            if (thinking !== reply.thinking) reply.parts.push(thinking);
            thinking.thinkingSignature = signature;
            reply.thinking = undefined;
            return;
          }
          case "TOOL_CALL_START": {
            toolNames.set(chunk.toolCallId, chunk.toolCallName);
            // A call re-run on resume was streamed by an earlier reply, not this one.
            if (!reply) return;
            const part: ToolCallContent = {
              type: "toolCall",
              id: chunk.toolCallId,
              name: chunk.toolCallName,
              arguments: {},
            };
            reply.parts.push(part);
            reply.args.set(chunk.toolCallId, { part, buffer: "" });
            reply.text = undefined;
            return;
          }
          case "TOOL_CALL_ARGS": {
            const call = reply?.args.get(chunk.toolCallId);
            if (call) call.buffer += chunk.delta;
            return;
          }
          case "TOOL_CALL_END": {
            const call = reply?.args.get(chunk.toolCallId);
            const input = asJsonObject(chunk.input);
            if (call && input) call.part.arguments = input;
            return;
          }
          case "RUN_FINISHED": {
            await persistReply(
              stopReasonOf(
                chunk.finishReason ?? chunk.metadata?.tanstack?.finishReason
              ),
              tokenUsageOf(chunk)
            );
            if (chunk.outcome?.type === "interrupt") {
              interrupted = chunk.outcome.interrupts.flatMap((entry) =>
                entry.toolCallId ? [entry.toolCallId] : []
              );
            }
            finished = true;
            return;
          }
          case "RUN_ERROR": {
            providerError =
              chunk.message ?? chunk.error?.message ?? "The provider failed.";
            await persistReply(
              StopReason.Error,
              tokenUsageOf(chunk),
              providerError
            );
            return;
          }
          case "TOOL_CALL_RESULT": {
            const toolCallId = chunk.toolCallId;
            const refusal = refusedCalls.get(toolCallId);
            const failed =
              refusal !== undefined ||
              chunk.metadata?.tanstack?.state === "output-error";
            const content = Array.isArray(chunk.content)
              ? JSON.stringify(chunk.content)
              : chunk.content;
            const text =
              refusal ?? (failed ? failedCallText(content) : content);
            const result: ToolResultMessage = {
              role: "toolResult",
              toolCallId,
              toolName: toolNames.get(toolCallId) ?? "unknown",
              content: [{ type: "text", text }],
              ...(!failed && {
                details: asJsonValue(toolResults.get(toolCallId)?.details),
              }),
              isError: failed,
              ...(declined.has(toolCallId) && {
                declined: {
                  ...(declined.get(toolCallId) !== undefined && {
                    comment: declined.get(toolCallId),
                  }),
                },
              }),
              timestamp: Date.now(),
            };
            const entry: NewSessionEntry<MessageEntry> = {
              type: "message",
              id: randomUUID(),
              parentId: cursor,
              timestamp: result.timestamp,
              message: result,
            };
            if (!(await append(entry))) return;
            onEvent(toolEndEvent(result, policy));
            return;
          }
          default:
            return;
        }
      };

      const turnMiddleware: ChatMiddleware = {
        name: "agent-turn",
        onIteration: () => {
          reply = {
            entryId: randomUUID(),
            parts: [],
            text: undefined,
            thinking: undefined,
            args: new Map(),
          };
          onEvent({ type: "assistant:start", messageId: reply.entryId });
        },
        onConfig: async (ctx, config) => {
          if (ctx.phase !== "beforeModel" || !volatileContext) return config;
          try {
            const text = await volatileContext();
            if (!text) return config;
            // Provider-only: the engine's history, and so the transcript, never carries it.
            return {
              ...config,
              providerMessages: [
                ...(config.providerMessages ?? config.messages),
                { role: "user", content: text },
              ],
            };
          } catch (error) {
            // Fail closed: a model that cannot see the current state must not act on it.
            failTurn(errorOfThrown(error), error);
            return config;
          }
        },
        onChunk: async (_ctx, chunk) => {
          await handleChunk(chunk);
        },
        onBeforeToolCall: async (_ctx, call) => {
          if (checkedCalls.has(call.toolCallId)) return undefined;
          try {
            const refusal = await checkCall({
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              input: call.args,
            });
            if (!refusal) return undefined;
            refusedCalls.set(call.toolCallId, refusal.reason);
            return { type: "skip", result: refusal.reason };
          } catch (error) {
            failTurn(errorOfThrown(error), error);
            refusedCalls.set(call.toolCallId, "This turn is being stopped.");
            return { type: "skip", result: "This turn is being stopped." };
          }
        },
        onAfterToolCall: (_ctx, info) => {
          const scope = policy.toolInfo(info.toolName).changes;
          if (!info.ok || !scope || refusedCalls.has(info.toolCallId)) return;
          stateRevision += 1;
          onEvent({ type: "state:changed", scope, revision: stateRevision });
        },
      };

      try {
        const stream = chat({
          adapter: binding.adapter,
          messages: request.messages,
          systemPrompts: [systemPrompt],
          tools: engineTools,
          modelOptions: binding.modelOptions,
          abortController: controller,
          // The engine's default stops after five model calls. A turn is bounded by its own budget
          // and deadline, and ends when the model stops calling tools.
          agentLoopStrategy: () => true,
          threadId: agentSessionId,
          runId: request.runId,
          ...(request.parentRunId !== undefined && {
            parentRunId: request.parentRunId,
          }),
          ...(request.resume && { resume: request.resume }),
          middleware: [modelSpans(binding), turnMiddleware],
        });
        for await (const _chunk of stream) {
          // Every chunk is handled, persisted and announced by the middleware before it arrives.
        }
      } catch (error) {
        if (hostFailure) {
          await persistReply(StopReason.Aborted, undefined);
          return { status: "error", error: hostFailure, cause: failureCause };
        }
        if (controller.signal.aborted && (aborted || isAbortError(error))) {
          await persistReply(StopReason.Aborted, undefined);
          return { status: "aborted" };
        }
        await persistReply(
          StopReason.Error,
          undefined,
          errorOfThrown(error).message
        );
        return {
          status: "error",
          error: errorOfProviderMessage(errorOfThrown(error).message),
          cause: error,
        };
      }

      // A reply still open ended with its run: the controller fired mid-generation, for an
      // abort or a host failure, whose kind the live turn reports and replay does not.
      if (reply) await persistReply(StopReason.Aborted, undefined);
      if (hostFailure)
        return { status: "error", error: hostFailure, cause: failureCause };
      if (aborted) return { status: "aborted" };
      if (providerError !== undefined) {
        return {
          status: "error",
          error: errorOfProviderMessage(providerError),
        };
      }
      if (interrupted && interrupted.length > 0) {
        return { status: "interrupted", toolCallIds: interrupted };
      }
      if (!finished) {
        return {
          status: "error",
          error: {
            kind: AgentErrorKind.Internal,
            message: "The turn ended without the model finishing.",
          },
        };
      }
      return { status: "done" };
    };

    let result: ChatResult = { status: "done" };
    let approvals: ApprovalBatch | undefined;

    /** The calls of the branch's last reply that have no result yet: what a resume answers. */
    const openCallsOf = (branch: readonly SessionEntry[]): Set<string> => {
      const answered = new Set<string>();
      for (let index = branch.length - 1; index >= 0; index -= 1) {
        const entry = branch[index];
        if (entry?.type !== "message") break;
        if (entry.message.role === "toolResult") {
          answered.add(entry.message.toolCallId);
          continue;
        }
        if (entry.message.role !== "assistant") break;
        return new Set(
          entry.message.content.flatMap((part) =>
            part.type === "toolCall" && !answered.has(part.id) ? [part.id] : []
          )
        );
      }
      return new Set();
    };

    let pass = 0;
    let parentRunId = resume?.interruptedRunId;
    let resumeItems = resume?.decisions.map(resumeItemOf);
    while (!hostFailure && !aborted && !treeFailed) {
      const branch = await session.getBranch(cursor);
      for (const [toolCallId, call] of callsOf(branch)) {
        toolNames.set(toolCallId, call.name);
      }
      const pending = resumeItems ? openCallsOf(branch) : undefined;
      const runId = pass === 0 ? agentRunId : `${agentRunId}:${pass}`;
      result = await runChat({
        messages: buildBranchContext(branch, {
          api: binding.api,
          pendingToolCallIds: pending,
        }),
        runId,
        parentRunId,
        resume: resumeItems,
      });
      if (result.status !== "interrupted") break;

      // The engine stopped on gated calls. Each passes the turn's own checks before it runs or
      // reaches the operator; a call that would fail anyway is refused here, and one whose tier
      // the session pre-approved runs without asking.
      const calls = callsOf(await session.getBranch(cursor));
      const requests: ApprovalRequest[] = [];
      const settled: SettledCall[] = [];
      for (const toolCallId of result.toolCallIds) {
        const call = calls.get(toolCallId);
        const request: ToolCallRequest = {
          toolCallId,
          toolName: call?.name ?? toolNames.get(toolCallId) ?? "unknown",
          input: call?.arguments ?? {},
        };
        const { tier } = policy.toolInfo(request.toolName);
        let refusal: ToolCallRefusal | undefined;
        let key: string;
        try {
          refusal = await checkCall(request);
          key = await approvalKeyOf(request);
        } catch (error) {
          failTurn(errorOfThrown(error), error);
          break;
        }
        checkedCalls.add(toolCallId);
        const answered = {
          toolCallId,
          toolName: request.toolName,
          args: request.input,
          key,
        };
        if (refusal) {
          settled.push({
            ...answered,
            approved: false,
            reason: refusal.reason,
          });
        } else if (settings.autoApprove.includes(tier)) {
          settled.push({ ...answered, approved: true });
        } else {
          requests.push({ ...answered, tier });
        }
      }
      if (hostFailure) break;
      if (requests.length > 0) {
        approvals = { requests, settled };
        break;
      }
      // An interrupt with no gated call to answer would stop the next pass the same way.
      if (settled.length === 0) {
        failTurn({
          kind: AgentErrorKind.Internal,
          message: "The engine stopped on nothing the turn can answer.",
        });
        break;
      }
      // Nothing reaches the operator: the turn answers the batch itself and the model goes on.
      for (const call of settled) {
        if (call.reason !== undefined) {
          refusedCalls.set(call.toolCallId, call.reason);
        }
      }
      parentRunId = runId;
      resumeItems = settled.map((call) =>
        resumeItemOf({
          toolCallId: call.toolCallId,
          approved: call.approved,
          comment: call.reason,
          refused: true,
        })
      );
      pass += 1;
    }
    clearTimeout(deadline);

    let failure: AgentTurnError | undefined;
    let cause: unknown = failureCause;
    if (hostFailure) failure = hostFailure;
    else if (result.status === "error") {
      failure = result.error;
      cause = result.cause;
    }
    // An abort that lands after the engine finished must still keep the turn from recording
    // approvals or compacting: the run is being cancelled, and rows written now would outlive it.
    const stopped = !failure && (aborted || result.status === "aborted");

    let awaiting: ApprovalRequest[] | undefined;
    if (!failure && !stopped && approvals) {
      try {
        await persistApprovals(approvals);
        awaiting = approvals.requests;
        for (const request of approvals.requests) {
          onEvent({
            type: "approval:request",
            toolCallId: request.toolCallId,
            toolName: request.toolName,
            tier: request.tier,
            args: request.args,
          });
        }
      } catch (error) {
        failure = errorOfThrown(error);
        cause = error;
      }
    }

    if (!failure && !stopped && awaiting === undefined) {
      try {
        const summariser = compaction ?? binding;
        const compacted = await compactSessionIfNeeded(
          {
            session,
            binding: summariser,
            onUsage,
          },
          compactionContextWindow(binding.model, summariser.model)
        );
        if (compacted) onEvent({ type: "session:compacted", ...compacted });
      } catch (error) {
        // The next clean turn boundary retries compaction.
        reportError(error, "Session compaction failed", {
          sessionId: agentSessionId,
          runId: agentRunId,
        });
      }
    }

    if (failure) {
      // The wire carries the kind alone; the detail and what threw stay in the log.
      const failed = {
        sessionId: agentSessionId,
        runId: agentRunId,
        kind: failure.kind,
        detail: failure.message,
      };
      // Provider and internal failures are this system's; the other kinds answer the caller.
      if (
        failure.kind === AgentErrorKind.Provider ||
        failure.kind === AgentErrorKind.Internal
      ) {
        reportError(cause ?? failure.message, "Agent turn failed", failed);
      } else {
        logger.warn({ ...failed, err: cause }, "Agent turn refused");
      }
      onEvent({ type: "error", kind: failure.kind });
    }

    const execution: AgentTurnExecution = failure
      ? { status: "error", error: failure }
      : stopped
        ? { status: "aborted" }
        : awaiting
          ? { status: "awaiting_approval", approvals: awaiting }
          : { status: "done" };

    onEvent({ type: "run:end", reason: execution.status });

    return execution;
  } finally {
    try {
      for (const cleanup of cleanups) cleanup();
    } finally {
      await flushEvents?.();
    }
  }
};

/**
 * Executes one turn on the engine, traced as one `invoke_agent` span. The branch is projected
 * into messages for each engine run; every finished message is appended to the session tree
 * before its event reaches the wire. Nothing about the run outlives the call.
 */
export const runTurn = (options: RunTurnOptions): Promise<AgentTurnExecution> =>
  traceAgentTurn(
    {
      sessionId: options.agentSessionId,
      runId: options.agentRunId,
      model: options.binding.model,
    },
    () => executeTurn(options)
  );
