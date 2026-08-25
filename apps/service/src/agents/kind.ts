import type { createAgentModels } from "@chia/agent-runtime/models";
import type {
  AgentModelInfo,
  AgentModelRef,
  ListModelsOptions,
} from "@chia/agent-runtime/models";
import type { ApprovalRequest } from "@chia/agent-runtime/pi/tool-gate";
import type { SessionTree } from "@chia/agent-runtime/session/tree";
import type {
  AgentCompactionResult,
  AgentNavigationOptions,
  AgentNavigationResult,
  AgentPolicy,
  AgentSessionDefaults,
  AgentSessionSettings,
  AgentTurnExecution,
  AgentTurnMessage,
} from "@chia/agent-runtime/types";
import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";
import type {
  AgentKindService,
  AgentServiceCaller,
} from "@chia/api/orpc/services/agent.service";
import type { DB } from "@chia/db/client";
import type { AgentSession } from "@chia/db/schema";
import type { CallerTier } from "@chia/service-kit/policies/caller.policy";

/**
 * What one agent kind contributes to the host.
 *
 * Everything an `AgentKindService` does that is not about *this* kind — session rows, durable
 * runs, streaming, abort, approvals, the turn step's bookkeeping — is generic and lives in
 * `./service.ts` and `steps/agent-turn.step.ts`. A kind supplies only the parts that differ:
 * its defaults and policy, which models it admits, the 1:1 state row it keeps beside
 * `agent.session`, and the Pi turn it runs. The definition composes the domain package with the
 * host's ports, which is why it lives in the app and not in the domain package.
 */
export interface AgentKindDefinition<TState> {
  /** `agent.session.kind`. */
  readonly kind: string;
  /**
   * Lowest {@link CallerTier} allowed to touch this kind at all. Never below `Session`: sessions
   * are owned by a user, so an anonymous or API-key caller has no owner to be. Restated on the
   * registry entry, which the guards read before the definition is loaded.
   */
  readonly minTier: CallerTier;
  readonly defaults: AgentSessionDefaults;
  /** Presentation of persisted tool entries on replay. */
  readonly policy: AgentPolicy;
  readonly models: {
    /** Throws `UnknownAgentModelError` when the kind does not admit the pair or it does not exist. */
    assert(ref: AgentModelRef): void;
    list(options: ListModelsOptions): AgentModelInfo[];
  };
  capabilities(): AgentKindCapabilities;
  readonly state: AgentKindState<TState>;
  runTurn<TApproval>(
    context: AgentTurnContext<TState, TApproval>
  ): Promise<AgentTurnExecution<TApproval>>;
  maintenance(options: AgentSessionOperationOptions): {
    compact(customInstructions?: string): Promise<AgentCompactionResult>;
    navigate(
      entryId: string,
      options: AgentNavigationOptions
    ): Promise<AgentNavigationResult>;
  };
}

export type AgentKindCapabilities = Awaited<
  ReturnType<AgentKindService["listCapabilities"]>
>;

export type AgentSessionSummary = Awaited<
  ReturnType<AgentKindService["listSessions"]>
>["items"][number];

export type AgentSessionDetail = NonNullable<
  Awaited<ReturnType<AgentKindService["getSession"]>>
>;

export type AgentDraftPayload = NonNullable<AgentSessionDetail["draft"]>;

/**
 * The kind's 1:1 extension row. `create` runs inside the generic `createSession` after the
 * `agent.session` row exists and is compensated by deleting that row if it throws; `load` returning
 * `null` makes the session invisible, so a half-created session can never be opened.
 */
export interface AgentKindState<TState> {
  create(
    caller: AgentServiceCaller,
    db: DB,
    sessionId: string,
    input: AgentCreateSessionInput
  ): Promise<void>;
  load(db: DB, sessionId: string): Promise<TState | null>;
  /**
   * Kind-owned fields of the session summary. The contract still carries the writing agent's
   * `targetFeedId` as an optional field; a kind with nothing to add returns `{}`.
   */
  summary(state: TState): Partial<Pick<AgentSessionSummary, "targetFeedId">>;
  /**
   * Kind-owned fields of the session detail, read fresh per request. The contract still carries
   * the writing agent's `draft` as an optional field; a kind with nothing to add returns `{}`.
   */
  detail(
    db: DB,
    sessionId: string,
    state: TState
  ): Promise<Partial<Pick<AgentSessionDetail, "draft" | "state">>>;
}

export type AgentCreateSessionInput = Parameters<
  AgentKindService["createSession"]
>[1];

export type AgentModels = ReturnType<typeof createAgentModels>;

export interface AgentSessionOperationOptions {
  session: SessionTree;
  settings: AgentSessionSettings;
  models: AgentModels;
}

/**
 * Everything the turn step has resolved before handing the turn to the kind: the owned session
 * row and its state, the opened session tree, the caller's credential-bearing models, and the
 * host-side approval plumbing. The kind adds its tools, ports and prompts and runs Pi.
 */
export interface AgentTurnContext<TState, TApproval> {
  db: DB;
  row: AgentSession;
  state: TState;
  settings: AgentSessionSettings;
  session: SessionTree;
  models: AgentModels;
  message: AgentTurnMessage;
  signal: AbortSignal;
  approvedToolCallIds: ReadonlySet<string>;
  preAuthorizedToolNames: ReadonlySet<string>;
  onEvent: (event: AgentWireEvent) => void;
  flushEvents: () => Promise<void>;
  toApproval: (request: ApprovalRequest) => TApproval;
  persistApprovals: (approvals: readonly TApproval[]) => Promise<void>;
}

/**
 * A registry entry. `minTier` is eager because the guards read it before any agent call; `load`
 * is a dynamic import because the definition pulls the domain package and the provider stack,
 * which must stay out of the boot path of a process whose other routes never touch an agent.
 */
export interface AgentKindEntry {
  readonly minTier: CallerTier;
  load(): Promise<AgentKindDefinition<unknown>>;
}
