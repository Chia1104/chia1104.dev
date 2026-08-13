import { AgentHarness, uuidv7 } from "@earendil-works/pi-agent-core";
import type {
  PromptTemplate,
  Session,
  Skill,
} from "@earendil-works/pi-agent-core";
import type { Api, Model, Models } from "@earendil-works/pi-ai";

import type { AgentPolicy, AgentSessionSettings, AgentTool } from "../types.ts";
import type { AgentTurnExecution, AgentTurnMessage } from "../types.ts";
import type { AgentWireEvent } from "../wire/schema.ts";

import { compactPiHarnessIfNeeded } from "./compaction.ts";
import { createPiWireEventMapper } from "./events.ts";
import { clampSessionThinkingLevel } from "./settings.ts";
import { createPiToolCallGate } from "./tool-gate.ts";
import type { ApprovalRequest } from "./tool-gate.ts";

export interface RunPiTurnOptions<TContext extends object, TApproval> {
  agentSessionId: string;
  session: Session;
  settings: AgentSessionSettings;
  model: Model<Api>;
  /** Must be the same credential-bearing collection that resolved `model`. */
  models: Models;
  tools: AgentTool<TContext>[];
  toolContext: TContext | (() => TContext | Promise<TContext>);
  systemPrompt: string | (() => string | Promise<string>);
  skills?: Skill[];
  promptTemplates?: PromptTemplate[];
  policy: AgentPolicy;
  approvedToolCallIds?: ReadonlySet<string>;
  preAuthorizedToolNames?: ReadonlySet<string>;
  message: AgentTurnMessage;
  onEvent: (event: AgentWireEvent) => void;
  toApproval: (request: ApprovalRequest) => TApproval;
  /** Persists the whole batch atomically, or rejects without leaving partial rows. */
  persistApprovals: (approvals: readonly TApproval[]) => Promise<void>;
  flushEvents?: () => Promise<void>;
}

const messageFor = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Executes one complete turn against Pi's concrete `AgentHarness`. */
export const runPiTurn = async <TContext extends object, TApproval>({
  agentSessionId,
  session,
  settings,
  model,
  models,
  tools,
  toolContext,
  systemPrompt: prompt,
  skills,
  promptTemplates,
  policy,
  approvedToolCallIds,
  preAuthorizedToolNames,
  message,
  onEvent,
  toApproval,
  persistApprovals,
  flushEvents,
}: RunPiTurnOptions<TContext, TApproval>): Promise<
  AgentTurnExecution<TApproval>
> => {
  const unsubscribers: (() => void)[] = [];

  try {
    const systemPrompt =
      typeof prompt === "string" ? prompt : async () => await prompt();

    /** Pi cannot reduce its conditional `toolContext` type while `TContext` is unresolved. */
    const turnHarness = new AgentHarness({
      session,
      models,
      model,
      tools,
      toolContext,
      thinkingLevel: clampSessionThinkingLevel(model, settings),
      activeToolNames: settings.activeToolNames ?? undefined,
      resources: { skills, promptTemplates },
      systemPrompt,
    } as never) as AgentHarness<TContext>;
    const gate = createPiToolCallGate({
      policy,
      autoApprove: settings.autoApprove,
      approvedToolCallIds,
      preAuthorizedToolNames,
    });
    unsubscribers.push(
      turnHarness.on("tool_call", (event) => gate.handle(event))
    );

    const turnId = uuidv7();
    const mapEvent = createPiWireEventMapper({
      messageIdPrefix: turnId,
      tierOf: policy.tierOf,
      labelOf: policy.labelOf,
      summarize: policy.summarize,
    });
    unsubscribers.push(
      turnHarness.subscribe((event) => {
        for (const wireEvent of mapEvent(event)) onEvent(wireEvent);
      })
    );

    if (policy.changesState) {
      let revision = 0;
      unsubscribers.push(
        turnHarness.on("tool_result", (event) => {
          if (
            !event.isError &&
            policy.changesState?.(policy.tierOf(event.toolName))
          ) {
            revision += 1;
            onEvent({
              type: "state:changed",
              scope: policy.stateScope,
              revision,
            });
          }
          return undefined;
        })
      );
    }

    onEvent({ type: "run:start", sessionId: agentSessionId });
    onEvent({
      type: "user",
      messageId: `u:${turnId}`,
      text: message.text,
    });

    let failure: string | undefined;
    try {
      if (message.template) {
        await turnHarness.promptFromTemplate(
          message.template.name,
          message.template.args
        );
      } else {
        await turnHarness.prompt(message.text);
      }
    } catch (error) {
      failure = messageFor(error);
    }

    let approvals: TApproval[] = [];
    if (!failure && gate.requests.length > 0) {
      try {
        const pending = gate.requests.map(toApproval);
        await persistApprovals(pending);
        approvals = pending;
      } catch (error) {
        failure = messageFor(error);
      }
    }

    if (!failure) {
      for (const request of gate.requests) {
        onEvent({
          type: "approval:request",
          toolCallId: request.toolCallId,
          toolName: request.toolName,
          tier: request.tier,
          args: request.args,
        });
      }
    }

    if (!failure && approvals.length === 0) {
      try {
        await compactPiHarnessIfNeeded(
          turnHarness,
          session,
          model.contextWindow
        );
      } catch {
        // The next clean turn boundary retries compaction.
      }
    }

    if (failure) onEvent({ type: "error", message: failure });

    const status: AgentTurnExecution<TApproval>["status"] = failure
      ? "error"
      : approvals.length > 0
        ? "awaiting_approval"
        : "done";

    onEvent({
      type: "run:end",
      reason: status === "awaiting_approval" ? "awaiting_approval" : status,
    });

    return { status, approvals, error: failure };
  } finally {
    try {
      for (const unsubscribe of unsubscribers) unsubscribe();
    } finally {
      await flushEvents?.();
    }
  }
};
