import { AgentHarness } from "@earendil-works/pi-agent-core";
import type {
  PromptTemplate,
  Session,
  Skill,
} from "@earendil-works/pi-agent-core";
import type { Api, Model, Models } from "@earendil-works/pi-ai";

import type { PendingMessageNotifier, PendingMessageStore } from "../ports.ts";
import type { AgentPolicy, AgentSessionSettings, AgentTool } from "../types.ts";
import type { AgentTurnExecution, AgentTurnMessage } from "../types.ts";
import type { AgentWireEvent } from "../wire/schema.ts";

import { compactPiHarnessIfNeeded } from "./compaction.ts";
import { createPiWireEventMapper } from "./events.ts";
import { clampSessionThinkingLevel } from "./settings.ts";
import { createPiToolCallGate } from "./tool-gate.ts";
import type { ApprovalRequest } from "./tool-gate.ts";

const DEFAULT_DRAIN_INTERVAL_MS = 1_000;

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
  pending?: PendingMessageStore;
  pendingNotifier?: PendingMessageNotifier;
  message: AgentTurnMessage;
  onEvent: (event: AgentWireEvent) => void;
  toApproval: (request: ApprovalRequest) => TApproval;
  persistApproval: (approval: TApproval) => Promise<void>;
  flushEvents?: () => Promise<void>;
  drainIntervalMs?: number;
}

const messageFor = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const deliverPendingMessages = async <TContext extends object>(
  harness: AgentHarness<TContext>,
  pending: PendingMessageStore | undefined,
  agentSessionId: string
): Promise<number> => {
  if (!pending) return 0;
  const messages = await pending.claim(agentSessionId);
  const undelivered = [...messages];

  try {
    for (const message of messages) {
      if (message.kind === "steer") await harness.steer(message.text);
      else await harness.followUp(message.text);
      undelivered.shift();
    }
  } catch (error) {
    await pending
      .release(undelivered.map((message) => message.id))
      .catch(() => undefined);
    throw error;
  }

  return messages.length;
};

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
  pending,
  pendingNotifier,
  message,
  onEvent,
  toApproval,
  persistApproval,
  flushEvents,
  drainIntervalMs = DEFAULT_DRAIN_INTERVAL_MS,
}: RunPiTurnOptions<TContext, TApproval>): Promise<
  AgentTurnExecution<TApproval>
> => {
  const unsubscribers: (() => void)[] = [];
  let drainInterval: ReturnType<typeof setInterval> | undefined;
  let activeDrain: Promise<void> | undefined;
  let drainRequested = false;
  let notifierSubscription:
    | Promise<(() => Promise<void>) | undefined>
    | undefined;

  const stopDraining = async () => {
    if (drainInterval) {
      clearInterval(drainInterval);
      drainInterval = undefined;
    }
    if (notifierSubscription) {
      const subscription = notifierSubscription;
      notifierSubscription = undefined;
      await (await subscription)?.().catch(() => undefined);
    }
    while (activeDrain) await activeDrain;
  };

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
      steeringMode: "all",
      followUpMode: "all",
    } as never) as AgentHarness<TContext>;
    const gate = createPiToolCallGate({
      policy,
      autoApprove: settings.autoApprove,
      approvedToolCallIds,
      preAuthorizedToolNames,
      onApprovalRequired: (request) =>
        onEvent({
          type: "approval:request",
          toolCallId: request.toolCallId,
          toolName: request.toolName,
          tier: request.tier,
          args: request.args,
        }),
    });
    unsubscribers.push(
      turnHarness.on("tool_call", (event) => gate.handle(event))
    );

    const mapEvent = createPiWireEventMapper({
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

    const drainPendingMessages = async () => {
      try {
        await deliverPendingMessages(turnHarness, pending, agentSessionId);
      } catch {
        // The undelivered tail was released. A later drain may retry it without failing the turn.
      }
    };

    const drain = (): Promise<void> => {
      if (activeDrain) {
        drainRequested = true;
        return activeDrain;
      }
      drainRequested = false;
      activeDrain = drainPendingMessages().finally(() => {
        activeDrain = undefined;
        if (drainRequested) void drain();
      });
      return activeDrain;
    };

    if (pending) {
      drainInterval = setInterval(() => void drain(), drainIntervalMs);
      notifierSubscription = pendingNotifier
        ?.subscribe(agentSessionId, () => void drain())
        .catch(() => undefined);
    }

    onEvent({ type: "run:start", sessionId: agentSessionId });
    const now = Date.now();
    onEvent({
      type: "user",
      messageId: `u-${now.toString(36)}`,
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
    } finally {
      await stopDraining();
    }

    const approvals: TApproval[] = [];
    for (const request of gate.requests) {
      const approval = toApproval(request);
      approvals.push(approval);
      await persistApproval(approval);
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
    await stopDraining();
    try {
      for (const unsubscribe of unsubscribers) unsubscribe();
    } finally {
      await flushEvents?.();
    }
  }
};
