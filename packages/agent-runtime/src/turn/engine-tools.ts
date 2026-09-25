import { toolDefinition } from "@tanstack/ai";
import type { StreamChunk } from "@tanstack/ai";
import * as z from "zod";

import { logger } from "@chia/observability/logger";
import { asJsonValue } from "@chia/utils/json";
import type { JsonValue } from "@chia/utils/json";

import type { ToolResultMessage } from "../messages.ts";
import { traceToolCall } from "../telemetry.ts";
import type { AgentTool, ToolResult } from "../tools.ts";
import type { AgentPolicy, AgentSessionSettings } from "../types.ts";

/**
 * A kind's active tools bound to the engine for one turn. The engine hands the model only the
 * text; `detailsOf` keeps what each call returned for clients.
 */
export const bindEngineTools = (
  tools: readonly AgentTool[],
  {
    policy,
    settings,
    log,
  }: {
    policy: Pick<AgentPolicy, "toolInfo" | "requiresApproval">;
    settings: Pick<AgentSessionSettings, "activeToolNames">;
    /** Identifies the turn beside a failed call in the log. */
    log: { sessionId: string; runId: string };
  }
) => {
  const results = new Map<string, ToolResult>();
  const active = settings.activeToolNames
    ? tools.filter((tool) => settings.activeToolNames?.includes(tool.name))
    : tools;

  const engineTools = active.map((tool) =>
    toolDefinition({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.parameters,
      // Gated by tier alone: a resumed turn rebuilds its pending calls from this flag, so the
      // session's auto-approval, which may change while a call waits, is applied per call.
      needsApproval: policy.requiresApproval(policy.toolInfo(tool.name).tier),
    }).server(async (input, context) => {
      const toolCallId = context?.toolCallId ?? "";
      try {
        const result = await traceToolCall(tool.name, toolCallId, () =>
          tool.execute(input, { toolCallId, signal: context?.abortSignal })
        );
        results.set(toolCallId, result);
        return result.text;
      } catch (error) {
        // The engine hands the throw to the model as an error result; the log is the only
        // record of what threw, and the model's input is as likely the cause as ours.
        logger.warn(
          { err: error, ...log, tool: tool.name, toolCallId },
          "Tool call failed"
        );
        throw error;
      }
    })
  );

  return {
    engineTools,
    detailsOf: (toolCallId: string): JsonValue | undefined =>
      asJsonValue(results.get(toolCallId)?.details),
  };
};

export type EngineTools = ReturnType<typeof bindEngineTools>;

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

/**
 * The engine's result for a call as the transcript stores it. A call the turn's own checks
 * answered reads as an error with their reason; one the operator declined records their comment.
 */
export const toolResultMessageOf = (
  chunk: Extract<StreamChunk, { type: "TOOL_CALL_RESULT" }>,
  call: {
    toolName: string;
    refusal: string | undefined;
    declined: { comment?: string } | undefined;
    details: JsonValue | undefined;
  }
): ToolResultMessage => {
  const failed =
    call.refusal !== undefined ||
    chunk.metadata?.tanstack?.state === "output-error";
  const content = Array.isArray(chunk.content)
    ? JSON.stringify(chunk.content)
    : chunk.content;
  return {
    role: "toolResult",
    toolCallId: chunk.toolCallId,
    toolName: call.toolName,
    content: [
      {
        type: "text",
        text: call.refusal ?? (failed ? failedCallText(content) : content),
      },
    ],
    ...(!failed && { details: call.details }),
    isError: failed,
    ...(call.declined && { declined: call.declined }),
    timestamp: Date.now(),
  };
};
