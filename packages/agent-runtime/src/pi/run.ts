import { Agent } from "@earendil-works/pi-agent-core";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { clampThinkingLevel, uuidv7 } from "@earendil-works/pi-ai";
import type {
  Api,
  AssistantMessage,
  Model,
  Models,
} from "@earendil-works/pi-ai";

import { AgentUsageSource } from "@chia/db/schema";

import type { AgentTool } from "../tools.ts";
import type { TurnControl } from "../turn/control.ts";
import type { TurnTranscript } from "../turn/transcript.ts";
import type {
  AgentPolicy,
  AgentSessionSettings,
  AgentUsageListener,
  ToolCallRefusal,
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
  /** Every check a call passes before it runs: budget, the kind's preflight, then approval. */
  check: (request: ToolCallRequest) => Promise<ToolCallRefusal | undefined>;
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

/**
 * Runs Pi's `Agent` from `messages`, which must end with a user or tool-result message. Each
 * finished reply and tool result is appended to the transcript before its events reach the
 * wire. Resolves the last reply the run persisted; failures the host raised are on `control`.
 */
export const runPiAgent = async (
  context: PiRunContext,
  messages: AgentMessage[]
): Promise<AssistantMessage | undefined> => {
  const { control, transcript, onEvent, policy, model, models } = context;
  if (control.controller.signal.aborted) return undefined;

  const tools = context.settings.activeToolNames
    ? context.tools.filter((tool) =>
        context.settings.activeToolNames?.includes(tool.name)
      )
    : context.tools;
  let stateRevision = 0;
  const volatileContext = context.volatileContext;

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
    streamFn: (requestModel, llmContext, options) =>
      models.streamSimple(requestModel, llmContext, options),
    transformContext: volatileContext
      ? async (current) => {
          try {
            const text = await volatileContext();
            return text ? [...current, volatileMessage(text)] : current;
          } catch (error) {
            // Fail closed: a model that cannot see the current state must not act on it.
            control.fail(errorOfThrown(error), error);
            return current;
          }
        }
      : undefined,
    beforeToolCall: async ({ toolCall, args }) => {
      try {
        const refusal = await context.check({
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          input: args,
        });
        return refusal && { block: true, reason: refusal.reason };
      } catch (error) {
        control.fail(errorOfThrown(error), error);
        return { block: true, reason: "This turn is being stopped." };
      }
    },
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
        if (event.message.role !== "assistant") return;
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
          await transcript.append({ id: uuidv7(), message }, [
            toolEndEvent(message, policy),
          ]);
        }
        return;
      }
      case "tool_execution_start": {
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
