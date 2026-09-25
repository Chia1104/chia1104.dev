import { formatPromptTemplateInvocation } from "@earendil-works/pi-agent-core";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { clampThinkingLevel, uuidv7 } from "@earendil-works/pi-ai";
import type {
  Api,
  AssistantMessage,
  Model,
  Models,
  UserMessage,
} from "@earendil-works/pi-ai";

import { logger } from "@chia/observability/logger";
import { reportError } from "@chia/observability/report";
import { asJsonValue, stableStringify } from "@chia/utils/json";

import {
  compactionContextWindow,
  compactSessionIfNeeded,
} from "./compaction.ts";
import { errorOfAssistantMessage, errorOfThrown } from "./pi/errors.ts";
import { runPiAgent } from "./pi/run.ts";
import type { PromptTemplate } from "./prompts.ts";
import { buildBranchContext } from "./session/context.ts";
import type { SessionEntry } from "./session/entries.ts";
import type { SessionTree } from "./session/tree.ts";
import { traceAgentTurn } from "./telemetry.ts";
import type { AgentTool } from "./tools.ts";
import { createToolCallApprovals } from "./turn/approvals.ts";
import { createTurnBudget } from "./turn/budget.ts";
import { createTurnControl } from "./turn/control.ts";
import type { TurnControl, TurnFailure } from "./turn/control.ts";
import { createTurnTranscript } from "./turn/transcript.ts";
import { AgentErrorKind, ApprovalVerdict } from "./types.ts";
import type {
  AgentPolicy,
  AgentSessionSettings,
  AgentTurnBudget,
  AgentTurnExecution,
  AgentTurnMessage,
  AgentTurnResume,
  AgentUsageListener,
  ApprovalBatch,
  ApprovalRequest,
  ToolCallRefusal,
  ToolCallRequest,
} from "./types.ts";
import type { AgentAttachment, AgentWireEvent } from "./wire/schema.ts";

export interface RunTurnBase {
  agentSessionId: string;
  /** The durable run this turn belongs to; logged beside failures so a stall can be traced. */
  agentRunId?: string;
  session: SessionTree;
  settings: AgentSessionSettings;
  model: Model<Api>;
  /** Must be the same credential-bearing collection that resolved `model`. */
  models: Models;
  /**
   * The model the end-of-turn compaction summarises with and the collection that resolved it;
   * the turn's own when omitted. A compaction pinned to a house model runs on the house
   * collection, so the caller's keys never pay for it.
   */
  compaction?: { model: Model<Api>; models: Models };
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
    : [{ type: "text", text }],
  timestamp: Date.now(),
});

/**
 * Renders the message's attachments, then screens it, before the model runs. The rendering is
 * persisted with the message, so the transcript carries what the model was shown. A failure
 * fails the turn: the model must not act on a message whose attachments it cannot see.
 */
const admitMessage = async (
  message: AgentTurnMessage,
  {
    renderAttachments,
    screen,
    signal,
  }: Pick<RunTurnBase, "renderAttachments" | "screen" | "signal">,
  control: TurnControl
): Promise<RenderedAttachments | undefined> => {
  let rendered: RenderedAttachments | undefined;
  if (message.attachments && message.attachments.length > 0) {
    try {
      if (!renderAttachments) {
        throw new Error("This agent kind does not accept attachments.");
      }
      rendered = await renderAttachments(message.attachments);
    } catch (error) {
      control.fail(
        {
          kind: AgentErrorKind.Internal,
          message: "The message's attachments could not be rendered.",
        },
        error
      );
    }
  }
  if (screen && !control.failure) {
    try {
      const refusal = await screen(message, signal);
      if (refusal) {
        control.fail({ kind: AgentErrorKind.Refused, message: refusal.reason });
      }
    } catch (error) {
      control.fail(errorOfThrown(error), error);
    }
  }
  return rendered;
};

/** Compacts at a clean turn boundary; a failure is reported and the next clean boundary retries. */
const compactAfterTurn = async ({
  agentSessionId,
  agentRunId,
  session,
  settings,
  model,
  models,
  compaction,
  onUsage,
  onEvent,
}: RunTurnOptions): Promise<void> => {
  try {
    const summariser = compaction?.model ?? model;
    const compacted = await compactSessionIfNeeded(
      {
        session,
        models: compaction?.models ?? models,
        model: summariser,
        thinkingLevel: clampThinkingLevel(summariser, settings.thinkingLevel),
        onUsage,
      },
      compactionContextWindow(model, summariser)
    );
    if (compacted) onEvent({ type: "session:compacted", ...compacted });
  } catch (error) {
    reportError(error, "Session compaction failed", {
      sessionId: agentSessionId,
      runId: agentRunId,
    });
  }
};

/** The wire carries the kind alone; the detail and what threw stay in the log. */
const reportTurnFailure = (
  { error, cause }: TurnFailure,
  ids: { sessionId: string; runId?: string }
): void => {
  const failed = { ...ids, kind: error.kind, detail: error.message };
  // Provider and internal failures are this system's; the other kinds answer the caller.
  if (
    error.kind === AgentErrorKind.Provider ||
    error.kind === AgentErrorKind.Internal
  ) {
    reportError(cause ?? error.message, "Agent turn failed", failed);
  } else {
    logger.warn({ ...failed, err: cause }, "Agent turn refused");
  }
};

/**
 * The reply a resumed turn continues from: the tree's last entry, the reply whose calls the
 * interrupted turn left open.
 */
const stoppedReplyOf = (
  branch: readonly SessionEntry[]
): AssistantMessage | undefined => {
  const last = branch.at(-1);
  return last?.type === "message" && last.message.role === "assistant"
    ? last.message
    : undefined;
};

const executeTurn = async (
  options: RunTurnOptions
): Promise<AgentTurnExecution> => {
  const {
    agentSessionId,
    agentRunId,
    session,
    settings,
    model,
    models,
    tools,
    systemPrompt,
    volatileContext,
    signal,
    promptTemplates = [],
    policy,
    budget,
    preflight,
    approvalKeyOf = defaultApprovalKey,
    message,
    resume,
    onEvent,
    persistApprovals,
    flushEvents,
    onUsage,
  } = options;
  const control = createTurnControl({
    signal,
    maxDurationMs: budget.maxDurationMs,
  });

  try {
    const turnBudget = createTurnBudget({
      budget,
      onExhausted: () =>
        control.fail({
          kind: AgentErrorKind.BudgetExhausted,
          message: `The model issued more than ${budget.hardMaxToolCalls} tool calls in one turn.`,
        }),
    });
    const rendered = message
      ? await admitMessage(message, options, control)
      : undefined;

    onEvent({ type: "run:start", sessionId: agentSessionId });
    const transcript = await createTurnTranscript({
      session,
      onEvent,
      fail: control.fail,
    });

    /** The branch the run continues from; unset when the model must not run. */
    let context:
      | { messages: AgentMessage[]; replay?: AssistantMessage }
      | undefined;
    if (resume) {
      // The decisions were persisted before this turn started; announcing them closes the
      // approval cards on a live view.
      for (const decision of resume.decisions) {
        onEvent({
          type: "approval:resolved",
          toolCallId: decision.toolCallId,
          approved: decision.verdict === ApprovalVerdict.Approved,
          comment: decision.comment,
        });
      }
      const branch = await session.getBranch(transcript.leafId);
      const replay = stoppedReplyOf(branch);
      if (!replay) {
        control.fail({
          kind: AgentErrorKind.Internal,
          message: "The session does not end on the reply this turn resumes.",
        });
      } else if (!control.aborted) {
        context = {
          messages: buildBranchContext(branch.slice(0, -1)),
          replay,
        };
      }
    } else {
      const id = uuidv7();
      onEvent({
        type: "user",
        messageId: id,
        text: message.text,
        attachments: rendered?.attachments,
        at: Date.now(),
      });
      // A failure raised before the model (unrenderable attachments, a refused message) keeps
      // the message out of the tree.
      if (!control.failure && !control.aborted) {
        let text: string | undefined;
        try {
          text = promptText(message, promptTemplates);
        } catch (error) {
          control.fail(errorOfThrown(error), error);
        }
        if (
          text !== undefined &&
          (await transcript.append({
            id,
            message: userMessageOf(text, rendered),
            attachments: rendered?.attachments,
          }))
        ) {
          context = {
            messages: buildBranchContext(
              await session.getBranch(transcript.leafId)
            ),
          };
        }
      }
    }

    const approvals = createToolCallApprovals({
      policy,
      autoApprove: settings.autoApprove,
      approvalKeyOf,
      check: async (request) =>
        turnBudget.handle(request) ?? (await preflight?.(request)),
      ...(context?.replay && {
        resume: {
          decisions: resume?.decisions ?? [],
          callIds: new Set(
            context.replay.content.flatMap((part) =>
              part.type === "toolCall" ? [part.id] : []
            )
          ),
        },
      }),
    });

    let reply: AssistantMessage | undefined;
    if (context && !control.failure) {
      try {
        reply = await runPiAgent(
          {
            sessionId: agentSessionId,
            runId: agentRunId,
            settings,
            model,
            models,
            systemPrompt,
            tools,
            volatileContext,
            policy,
            approvals,
            control,
            transcript,
            onEvent,
            onUsage,
          },
          context.messages,
          context.replay
        );
      } catch (error) {
        control.fail(errorOfThrown(error), error);
      }
    }
    control.endGeneration();

    // Pi resolves provider failures as an assistant message rather than throwing: `error`
    // carries the provider's text (post-retry), `aborted` means the run's controller fired. A
    // resumed turn whose calls were all held again has no new reply of its own.
    let failure: TurnFailure | undefined = control.failure;
    if (!failure && context && !control.aborted) {
      if (!reply && !approvals.interrupted) {
        failure = {
          error: {
            kind: AgentErrorKind.Internal,
            message: "The turn completed without an assistant message.",
          },
        };
      } else if (reply?.stopReason === "error") {
        failure = {
          error: errorOfAssistantMessage(reply, model.contextWindow),
        };
      }
    }
    // An abort that lands after the reply resolved must still keep the turn from recording
    // approvals or compacting: the run is being cancelled, and rows written now would outlive it.
    const stopped =
      !failure && (control.aborted || reply?.stopReason === "aborted");

    let awaiting: ApprovalRequest[] | undefined;
    const batch = approvals.interrupted;
    if (!failure && !stopped && batch) {
      try {
        await persistApprovals(batch);
        awaiting = batch.requests;
        for (const request of batch.requests) {
          onEvent({
            type: "approval:request",
            toolCallId: request.toolCallId,
            toolName: request.toolName,
            tier: request.tier,
            args: request.args,
          });
        }
      } catch (error) {
        failure = { error: errorOfThrown(error), cause: error };
      }
    }

    if (!failure && !stopped && awaiting === undefined) {
      await compactAfterTurn(options);
    }

    if (failure) {
      reportTurnFailure(failure, {
        sessionId: agentSessionId,
        runId: agentRunId,
      });
      onEvent({ type: "error", kind: failure.error.kind });
    }

    const execution: AgentTurnExecution = failure
      ? { status: "error", error: failure.error }
      : stopped
        ? { status: "aborted" }
        : awaiting
          ? { status: "awaiting_approval", approvals: awaiting }
          : { status: "done" };

    onEvent({ type: "run:end", reason: execution.status });

    return execution;
  } finally {
    try {
      control.dispose();
    } finally {
      await flushEvents?.();
    }
  }
};

/**
 * Executes one turn on Pi, traced as one `invoke_agent` span. The operator's message is appended
 * to the session tree, or a stopped reply's calls are resumed, then Pi's `Agent` continues from
 * the branch projected into messages; every finished message is appended before its event
 * reaches the wire. Nothing about the run outlives the call.
 */
export const runTurn = (options: RunTurnOptions): Promise<AgentTurnExecution> =>
  traceAgentTurn(
    {
      sessionId: options.agentSessionId,
      runId: options.agentRunId,
      model: options.model,
    },
    () => executeTurn(options)
  );
