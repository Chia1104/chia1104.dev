import type * as z from "zod";

import type { createAgentModels } from "@chia/agent-runtime/models";
import type {
  AgentModel,
  AgentModelInfo,
  AgentModelRef,
  ListModelsOptions,
} from "@chia/agent-runtime/models";
import type { ApprovalRequest } from "@chia/agent-runtime/pi/tool-gate";
import type { SessionTree } from "@chia/agent-runtime/session/tree";
import type {
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
 * runs, streaming, abort, approvals, compaction and rewind, the turn step's bookkeeping — is
 * generic and lives in `./service.ts` and `steps/agent-turn.step.ts`. A kind supplies only the
 * parts that differ: its defaults and policy, which models it admits, its operator
 * configuration, the 1:1 state row it keeps beside `agent.session`, and the Pi turn it runs.
 * The definition composes the domain package with the host's ports, which is why it lives in
 * the app and not in the domain package.
 *
 * `defaults` and `config` are the code's values. The operator overrides them per kind in
 * `agent.kind_config`; `./config.ts` resolves the effective ones.
 */
export interface AgentKindDefinition<TState, TConfig extends object> {
  /** `agent.session.kind`. */
  readonly kind: string;
  /** Operator-facing name and one-line purpose, for the dashboard's agent workspace. */
  readonly label: string;
  readonly description: string;
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
    /** Resolves an admitted pair on the caller's credential-bearing collection; throws like `assert`. */
    resolve(ref: AgentModelRef, models: AgentModels): AgentModel;
  };
  readonly config: AgentKindConfigDefinition<TConfig>;
  capabilities(): AgentKindCapabilities;
  readonly state: AgentKindState<TState>;
  runTurn?<TApproval>(
    context: AgentTurnContext<TState, TConfig, TApproval>
  ): Promise<AgentTurnExecution<TApproval>>;
}

/**
 * The kind's operator configuration: what the dashboard may change about this kind without a
 * deploy. Preferences only — tool tiers, the approval policy, the turn budget and the model
 * allowlist are safety boundaries and stay in code. `schema` validates the operator's write
 * and is sent to the dashboard as JSON Schema, so a new field needs no contract change.
 */
export interface AgentKindConfigDefinition<TConfig extends object> {
  readonly schema: z.ZodType<TConfig>;
  readonly defaults: TConfig;
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
   * Copies the kind's state of `sourceSessionId` onto the freshly forked `sessionId`, whose
   * `agent.session` row and transcript already exist. State is copied as it stands now — it is
   * not versioned against the transcript, so a fork taken from an earlier entry still carries
   * the current draft. Compensated like `create` when it throws.
   */
  fork(db: DB, sourceSessionId: string, sessionId: string): Promise<void>;
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

/**
 * Everything the turn step has resolved before handing the turn to the kind: the owned session
 * row and its state, the kind's effective configuration, the opened session tree, the caller's
 * credential-bearing models, and the host-side approval plumbing. The kind adds its tools, ports
 * and prompts and runs Pi.
 */
export interface AgentTurnContext<TState, TConfig extends object, TApproval> {
  db: DB;
  row: AgentSession;
  state: TState;
  /** The operator's kind configuration as of this turn; see `./config.ts`. */
  config: TConfig;
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
  load(): Promise<AgentKindDefinition<unknown, object>>;
}
