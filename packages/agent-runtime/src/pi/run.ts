import { Agent } from "@earendil-works/pi-agent-core";
import type {
  AgentMessage,
  AgentTool as PiAgentTool,
} from "@earendil-works/pi-agent-core";
import {
  clampThinkingLevel,
  createAssistantMessageEventStream,
  uuidv7,
  validateToolArguments,
} from "@earendil-works/pi-ai";
import type {
  Api,
  AssistantMessage,
  Model,
  Models,
} from "@earendil-works/pi-ai";

import { AgentUsageSource } from "@chia/db/schema";
import { asJsonObject } from "@chia/utils/json";

import type { DeclinedToolResult } from "../session/entries.ts";
import type { AgentTool } from "../tools.ts";
import type { ToolCallApprovals } from "../turn/approvals.ts";
import type { TurnControl } from "../turn/control.ts";
import type { TurnTranscript } from "../turn/transcript.ts";
import type {
  AgentPolicy,
  AgentSessionSettings,
  AgentUsageListener,
  ToolCallRequest,
} from "../types.ts";
import {
  assistantEndEvent,
  toolEndEvent,
  toolStartEvent,
} from "../wire/replay.ts";
import type { AgentWireEvent } from "../wire/schema.ts";

import { errorOfThrown } from "./errors.ts";
import { toPiTool } from "./tools.ts";

/** The turn one Pi run executes inside. */
export interface PiRunContext {
  sessionId: string;
  runId?: string;
  settings: Pick<AgentSessionSettings, "thinkingLevel" | "activeToolNames">;
  model: Model<Api>;
  /** The credential-bearing collection that resolved `model`. */
  models: Models;
  systemPrompt: string;
  tools: readonly AgentTool[];
  volatileContext?: () => string | undefined | Promise<string | undefined>;
  policy: AgentPolicy;
  /** Decides whether each call runs, is refused, or is held for the operator. */
  approvals: ToolCallApprovals;
  control: TurnControl;
  transcript: TurnTranscript;
  onEvent: (event: AgentWireEvent) => void;
  onUsage?: AgentUsageListener;
}

const volatileMessage = (text: string): AgentMessage => ({
  role: "user",
  content: [{ type: "text", text }],
  timestamp: Date.now(),
});

/** What the model reads for a call held for the operator; never persisted. */
const HELD = "This call is waiting for the operator's decision.";

/** A reply the provider already sent, streamed again without calling it. */
const replayStream = (message: AssistantMessage) => {
  const stream = createAssistantMessageEventStream();
  stream.push({ type: "start", partial: message });
  stream.push({
    type: "done",
    reason: message.stopReason === "toolUse" ? "toolUse" : "stop",
    message,
  });
  stream.end(message);
  return stream;
};

/**
 * A reply's calls as the checks see them: validated and coerced as Pi will run them, or as the
 * model sent them when they do not validate, which Pi then answers with the error.
 */
const callsOf = (
  message: AssistantMessage,
  tools: readonly PiAgentTool[]
): ToolCallRequest[] =>
  message.content.flatMap((part) => {
    if (part.type !== "toolCall") return [];
    const tool = tools.find((candidate) => candidate.name === part.name);
    let input: unknown = part.arguments;
    if (tool) {
      try {
        const prepared = asJsonObject(tool.prepareArguments?.(part.arguments));
        input = validateToolArguments(
          tool,
          prepared ? { ...part, arguments: prepared } : part
        );
      } catch {
        input = part.arguments;
      }
    }
    return [{ toolCallId: part.id, toolName: part.name, input }];
  });

/**
 * Runs Pi's `Agent` from `messages`, which must end with a user or tool-result message. Each
 * finished reply and tool result is appended to the transcript before its events reach the
 * wire. Resolves the last reply the run persisted; failures the host raised are on `control`.
 *
 * `replay` resumes a reply the tree already holds, whose calls were stopped on: it is streamed
 * to Pi in place of the first provider request, so Pi runs its calls, with the operator's
 * answers, exactly as it would have. Nothing about the replayed reply is persisted or announced
 * again.
 */
export const runPiAgent = async (
  context: PiRunContext,
  messages: AgentMessage[],
  replay?: AssistantMessage
): Promise<AssistantMessage | undefined> => {
  const { control, transcript, onEvent, policy, model, models, approvals } =
    context;
  if (control.controller.signal.aborted) return undefined;

  const tools = context.settings.activeToolNames
    ? context.tools.filter((tool) =>
        context.settings.activeToolNames?.includes(tool.name)
      )
    : context.tools;
  let stateRevision = 0;
  const volatileContext = context.volatileContext;
  const batches = new WeakMap<AssistantMessage, ToolCallRequest[]>();
  const replayedCalls = new Set(
    replay?.content.flatMap((part) =>
      part.type === "toolCall" ? [part.id] : []
    )
  );
  let pendingReplay = replay;
  let replaying = false;
  /**
   * The turn's volatile context, read once and placed where the turn's first request ended: after
   * the message that started it, or before a resumed reply. A request hits the provider's cache
   * only when the previous request's whole prompt is a prefix of it, so a fresh message at the end
   * of every request would leave only the system prompt cached.
   */
  let snapshot: { at: number; message: AgentMessage | undefined } | undefined;

  const agent = new Agent({
    initialState: {
      systemPrompt: context.systemPrompt,
      model,
      thinkingLevel: clampThinkingLevel(model, context.settings.thinkingLevel),
      tools: tools.map((tool) =>
        toPiTool(tool, {
          policy,
          log: { sessionId: context.sessionId, runId: context.runId },
        })
      ),
      messages,
    },
    // Bound to this turn's collection rather than a process-wide default: the collection
    // carries the operator's own credentials, and a default would let a BYOK turn fall back
    // to ambient keys.
    streamFn: (requestModel, llmContext, options) => {
      if (pendingReplay) {
        const message = pendingReplay;
        pendingReplay = undefined;
        replaying = true;
        return replayStream(message);
      }
      return models.streamSimple(requestModel, llmContext, options);
    },
    transformContext: volatileContext
      ? async (current) => {
          try {
            if (!snapshot) {
              const text = await volatileContext();
              snapshot = {
                at: current.length,
                message: text ? volatileMessage(text) : undefined,
              };
            }
          } catch (error) {
            // Fail closed: a model that cannot see the current state must not act on it.
            control.fail(errorOfThrown(error), error);
            return current;
          }
          const { at, message } = snapshot;
          return message
            ? [...current.slice(0, at), message, ...current.slice(at)]
            : current;
        }
      : undefined,
    beforeToolCall: async ({
      assistantMessage,
      toolCall,
      args,
      context: loop,
    }) => {
      try {
        let batch = batches.get(assistantMessage);
        if (!batch) {
          batch = callsOf(assistantMessage, loop.tools ?? []);
          batches.set(assistantMessage, batch);
        }
        const answer = await approvals.answer(
          { toolCallId: toolCall.id, toolName: toolCall.name, input: args },
          batch
        );
        switch (answer.type) {
          case "run":
            return undefined;
          case "refuse":
            return { block: true, reason: answer.reason };
          case "hold":
            return { block: true, reason: HELD };
          default: {
            const _exhaustive: never = answer;
            return _exhaustive;
          }
        }
      } catch (error) {
        control.fail(errorOfThrown(error), error);
        return { block: true, reason: "This turn is being stopped." };
      }
    },
    // A batch held for the operator ends the run: its calls wait with no result until they
    // answer, and a resumed turn runs them.
    finishTurn: () => (approvals.interrupted ? { action: "end" } : undefined),
    afterToolCall: async ({ toolCall, isError }) => {
      const scope = policy.toolInfo(toolCall.name).changes;
      if (!isError && scope) {
        stateRevision += 1;
        onEvent({ type: "state:changed", scope, revision: stateRevision });
      }
      return undefined;
    },
  });

  /**
   * A reply's id is chosen when it starts, so `assistant:start` and the entry the tree persists
   * it under agree, and a client can hand any message id back as a rewind or fork target.
   */
  let replyId: string | undefined;
  let reply: AssistantMessage | undefined;
  const unsubscribe = agent.subscribe(async (event) => {
    if (transcript.failed) return;
    switch (event.type) {
      case "message_start": {
        if (event.message.role !== "assistant" || replaying) return;
        replyId = uuidv7();
        onEvent({ type: "assistant:start", messageId: replyId });
        return;
      }
      case "message_update": {
        const inner = event.assistantMessageEvent;
        if (!replyId) return;
        if (inner.type !== "text_delta" && inner.type !== "thinking_delta") {
          return;
        }
        onEvent({
          type: "assistant:delta",
          messageId: replyId,
          channel: inner.type === "text_delta" ? "text" : "thinking",
          delta: inner.delta,
        });
        return;
      }
      case "message_end": {
        const { message } = event;
        if (message.role === "assistant" && replaying) {
          replaying = false;
          return;
        }
        if (message.role === "assistant") {
          const id = replyId ?? uuidv7();
          replyId = undefined;
          if (
            !(await transcript.append({ id, message }, [
              assistantEndEvent(id, message),
            ]))
          ) {
            return;
          }
          reply = message;
          // Reported by what the provider says answered, not what was asked for: the two
          // differ when a gateway routes a request, and the bill follows the provider.
          await context.onUsage?.({
            source: AgentUsageSource.Turn,
            providerId: message.provider,
            modelId: message.model,
            usage: message.usage,
            entryId: id,
          });
        } else if (message.role === "toolResult") {
          const answer = approvals.answerOf(message.toolCallId);
          // A held call stays open in the tree, so the turn that resumes it can run it.
          if (answer?.type === "hold") return;
          const result: DeclinedToolResult | typeof message =
            answer?.type === "refuse" && answer.declined
              ? { ...message, declined: answer.declined }
              : message;
          await transcript.append({ id: uuidv7(), message: result }, [
            toolEndEvent(result, policy),
          ]);
        }
        return;
      }
      case "tool_execution_start": {
        // A resumed call's card was announced by the turn that stopped on it.
        if (replayedCalls.has(event.toolCallId)) return;
        onEvent(
          toolStartEvent(
            {
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              args: event.args,
            },
            policy
          )
        );
        return;
      }
      default:
        return;
    }
  });

  const abortRun = () => agent.abort();
  control.controller.signal.addEventListener("abort", abortRun, {
    once: true,
  });
  try {
    await agent.continue();
  } finally {
    control.controller.signal.removeEventListener("abort", abortRun);
    unsubscribe();
  }
  return reply;
};
