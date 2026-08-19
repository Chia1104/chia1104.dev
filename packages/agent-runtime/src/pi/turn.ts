import { AgentHarness, uuidv7 } from "@earendil-works/pi-agent-core";
import type {
  AgentMessage,
  PromptTemplate,
  Session,
  Skill,
} from "@earendil-works/pi-agent-core";
import type {
  Api,
  AssistantMessage,
  Model,
  Models,
} from "@earendil-works/pi-ai";

import type { AgentPolicy, AgentSessionSettings, AgentTool } from "../types.ts";
import type {
  AgentTurnError,
  AgentTurnExecution,
  AgentTurnMessage,
} from "../types.ts";
import type { AgentWireEvent } from "../wire/schema.ts";

import { compactPiHarnessIfNeeded } from "./compaction.ts";
import { errorOfAssistantMessage, errorOfThrown } from "./errors.ts";
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
  /**
   * Stable for the life of a session. It heads every provider request, so anything that changes
   * turn to turn belongs in `volatileContext` instead — a changed system prompt invalidates the
   * cached prefix for the system prompt, the tool schemas and the whole transcript behind it.
   */
  systemPrompt: string | (() => string | Promise<string>);
  /**
   * Current state the model should see on every provider request: draft status, clock, anything
   * that would be stale by the next hop. Appended as the last message of the request and never
   * persisted, so it costs no transcript space and cannot go stale in history. Undefined omits it.
   */
  volatileContext?: () => string | undefined | Promise<string | undefined>;
  /**
   * Host-owned abort. Firing it aborts the harness at once, mid-generation included: Pi cancels
   * the in-flight provider stream and the turn ends as `aborted`. Already-aborted on entry skips
   * the provider entirely.
   */
  signal?: AbortSignal;
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

const volatileMessage = (text: string): AgentMessage => ({
  role: "user",
  content: [{ type: "text", text }],
  timestamp: Date.now(),
});

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
  volatileContext,
  signal,
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
      prompt instanceof Function ? async () => await prompt() : prompt;

    /** Pi cannot reduce its conditional `toolContext` type while `TContext` is unresolved. */
    const turnHarness =
      /* SAFETY: The producer contract guarantees this value satisfies the asserted interface. */ new AgentHarness(
        /* SAFETY: The producer contract guarantees this value satisfies never. */ {
          session,
          models,
          model,
          tools,
          toolContext,
          thinkingLevel: clampSessionThinkingLevel(model, settings),
          activeToolNames: settings.activeToolNames ?? undefined,
          resources: { skills, promptTemplates },
          systemPrompt,
        } as never
      ) as AgentHarness<TContext>;
    const gate = createPiToolCallGate({
      policy,
      autoApprove: settings.autoApprove,
      approvedToolCallIds,
      preAuthorizedToolNames,
    });
    unsubscribers.push(
      turnHarness.on("tool_call", (event) => gate.handle(event))
    );

    /**
     * A failure raised by the host inside a Pi hook. Pi turns a throwing hook into an assistant
     * message with `stopReason: "error"`, indistinguishable from a provider failure, so hooks catch
     * their own errors here and the turn is failed as `internal` once the harness has unwound.
     */
    let hostFailure: AgentTurnError | undefined;

    if (volatileContext) {
      unsubscribers.push(
        turnHarness.on("context", async (event) => {
          try {
            const text = await volatileContext();
            if (!text) return undefined;
            return { messages: [...event.messages, volatileMessage(text)] };
          } catch (error) {
            // Fail closed: a model that cannot see the current state must not act on it. Not awaited
            // — `abort()` waits for the run to settle, and this hook is on the run's own path.
            hostFailure = errorOfThrown(error);
            void turnHarness.abort().catch(() => undefined);
            return undefined;
          }
        })
      );
    }

    if (signal) {
      // Not awaited: `abort()` waits for the run to settle, and the hook below is on the run's own
      // path. Signalling is enough — the loop observes the aborted controller and unwinds.
      const abortHarness = () =>
        void turnHarness.abort().catch(() => undefined);
      signal.addEventListener("abort", abortHarness, { once: true });
      unsubscribers.push(() =>
        signal.removeEventListener("abort", abortHarness)
      );
      // An abort that fires before the run has armed its controller is a no-op for the harness;
      // re-checking at the next provider boundary closes that window without any I/O.
      unsubscribers.push(
        turnHarness.on("before_provider_request", () => {
          if (signal.aborted) abortHarness();
          return undefined;
        })
      );
    }

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
      at: Date.now(),
    });

    let failure: AgentTurnError | undefined;
    let aborted = signal?.aborted ?? false;
    if (!aborted) {
      try {
        // Pi resolves provider failures as an assistant message rather than throwing: `error`
        // carries the provider's text (post-retry), `aborted` means the run's controller fired.
        const reply: AssistantMessage = message.template
          ? await turnHarness.promptFromTemplate(
              message.template.name,
              message.template.args
            )
          : await turnHarness.prompt(message.text);
        if (hostFailure) failure = hostFailure;
        else if (reply.stopReason === "aborted") aborted = true;
        else if (reply.stopReason === "error") {
          failure = errorOfAssistantMessage(reply, model.contextWindow);
        }
      } catch (error) {
        failure = hostFailure ?? errorOfThrown(error);
      }
    }
    // An abort that lands after the reply resolved must still keep the turn from persisting
    // approvals or compacting: the run is being cancelled, and rows written now would outlive it.
    if (!failure && signal?.aborted) aborted = true;

    let approvals: TApproval[] = [];
    if (!failure && !aborted && gate.requests.length > 0) {
      try {
        const pending = gate.requests.map(toApproval);
        await persistApprovals(pending);
        approvals = pending;
      } catch (error) {
        failure = errorOfThrown(error);
      }
    }

    if (!failure && !aborted) {
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

    if (!failure && !aborted && approvals.length === 0) {
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

    if (failure) onEvent({ type: "error", ...failure });

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
