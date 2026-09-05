import type * as z from "zod";

import type { createAgentModels } from "@chia/agent-runtime/models";
import type {
  AgentModel,
  AgentModelAccess,
  AgentModelInfo,
  AgentModelRef,
} from "@chia/agent-runtime/models";
import type { ApprovalRequest } from "@chia/agent-runtime/pi/tool-gate";
import type { SessionTree } from "@chia/agent-runtime/session/tree";
import type {
  AgentAttachment,
  AgentPolicy,
  AgentSessionDefaults,
  AgentSessionSettings,
  AgentTurnExecution,
  AgentTurnMessage,
  AgentUsageListener,
} from "@chia/agent-runtime/types";
import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";
import type { DB } from "@chia/db/client";
import type { AgentSession } from "@chia/db/schema";
import type { Locale } from "@chia/db/types";
import type { ServiceContext } from "@chia/service-kit/context";
import type {
  Caller,
  CallerTier,
} from "@chia/service-kit/policies/caller.policy";
import type { JsonObject } from "@chia/utils/json";

/**
 * What one agent kind contributes to the host. Generic session/turn machinery lives in
 * `packages/api`. A kind supplies the parts that differ: defaults, policy, models, operator
 * config, the 1:1 state row, and the Pi turn. `defaults` and `config` are the code's values;
 * the operator overrides them in `agent.kind_config`.
 */
export interface AgentKindDefinition<TState, TConfig extends object> {
  readonly kind: string;
  readonly label: string;
  readonly description: string;
  /**
   * Lowest {@link CallerTier} allowed to touch this kind. Never below `Guest`: sessions are
   * owned by a user, so an anonymous or API-key caller has no owner. Restated eagerly on
   * {@link AgentKindEntry}, which the guards read before the definition is loaded.
   */
  readonly minTier: CallerTier;
  readonly defaults: AgentSessionDefaults;
  readonly policy: AgentPolicy;
  /**
   * `access` is which keys the caller holds; `house` is the kind's effective default model,
   * the one the house pays for when the caller holds none.
   */
  readonly models: {
    /** Throws `UnknownAgentModelError` when the kind does not admit the pair for this caller or it does not exist. */
    assert(
      ref: AgentModelRef,
      access: AgentModelAccess,
      house: AgentModelRef
    ): void;
    list(access: AgentModelAccess, house: AgentModelRef): AgentModelInfo[];
    /** Resolves an admitted pair on the caller's credential-bearing collection; throws like `assert`. */
    resolve(
      ref: AgentModelRef,
      models: AgentModels,
      access: AgentModelAccess,
      house: AgentModelRef
    ): AgentModel;
  };
  readonly config: AgentKindConfigDefinition<TConfig>;
  capabilities(): AgentKindCapabilities;
  readonly state: AgentKindState<TState>;
  runTurn?<TApproval>(
    context: AgentTurnContext<TState, TConfig, TApproval>
  ): Promise<AgentTurnExecution<TApproval>>;
}

/**
 * Operator preferences the dashboard may change without a deploy. Tool tiers, approval,
 * turn budget and the model allowlist stay in code. `schema` is sent to the dashboard as JSON
 * Schema, so a new field needs no contract change.
 */
export interface AgentKindConfigDefinition<TConfig extends object> {
  readonly schema: z.ZodType<TConfig>;
  readonly defaults: TConfig;
}

export interface AgentKindCapabilities {
  tools: {
    name: string;
    label: string;
    tier: string;
    description: string;
  }[];
  commands: { name: string; description: string; argumentHint?: string }[];
  skills: { name: string; description: string }[];
}

export interface AgentKindCaller extends Caller {
  userId: string;
  context: ServiceContext;
}

export interface AgentCreateSessionInput {
  title?: string;
  model?: AgentModelRef;
  thinkingLevel?: string;
  autoApprove?: string[];
  runtimeConfig?: JsonObject;
}

/** A shared draft the writing agent works on, as the contract's `drafts` field carries it. */
export interface AgentDraftPayload {
  id: number;
  feedId: number | null;
  revision: number;
  appliedRevision: number | null;
  slug: string | null;
  type: "post" | "note";
  defaultLocale: Locale;
  mainImage: string | null;
  translations: Partial<
    Record<
      Locale,
      {
        title: string | null;
        excerpt: string | null;
        description: string | null;
        summary: string | null;
        content: string | null;
      }
    >
  >;
  createdAt: string;
  updatedAt: string;
}

/**
 * The kind's 1:1 extension row. `create` runs after the `agent.session` row exists and is
 * compensated by deleting that row if it throws; `load` returning `null` makes the session
 * invisible, so a half-created session can never be opened.
 */
export interface AgentKindState<TState> {
  create(
    caller: AgentKindCaller,
    db: DB,
    sessionId: string,
    input: AgentCreateSessionInput
  ): Promise<void>;
  load(db: DB, sessionId: string): Promise<TState | null>;
  /**
   * Copies the kind's state of `sourceSessionId` onto the freshly forked `sessionId`. State
   * is copied as it stands now: it is not versioned against the transcript, so a fork from an
   * earlier entry still carries the current draft. Compensated like `create` when it throws.
   */
  fork(db: DB, sourceSessionId: string, sessionId: string): Promise<void>;
  /**
   * Kind-owned fields of the session detail. The contract still carries the writing agent's
   * `drafts`; a kind with nothing to add returns `{}`.
   */
  detail(
    db: DB,
    sessionId: string,
    state: TState
  ): Promise<{ drafts?: AgentDraftPayload[]; state?: unknown }>;
  /**
   * Admits a prompt's attachments before the turn is enqueued: refuses a type the kind does
   * not take or a record the caller does not own, and records the rest against the session.
   * A kind without it accepts no attachments.
   */
  attach?(
    caller: AgentKindCaller,
    db: DB,
    sessionId: string,
    attachments: readonly AgentAttachment[]
  ): Promise<void>;
}

export type AgentModels = ReturnType<typeof createAgentModels>;

/**
 * What the turn step has resolved before handing the turn to the kind. The kind adds its
 * tools, ports and prompts and runs Pi.
 */
export interface AgentTurnContext<TState, TConfig extends object, TApproval> {
  db: DB;
  row: AgentSession;
  state: TState;
  config: TConfig;
  settings: AgentSessionSettings;
  session: SessionTree;
  models: AgentModels;
  /** Which keys the request carried; `models` was built from the same set. */
  access: AgentModelAccess;
  /** The kind's effective default model, as the operator configured it. */
  house: AgentModelRef;
  message: AgentTurnMessage;
  signal: AbortSignal;
  approvedToolCallIds: ReadonlySet<string>;
  preAuthorizedToolNames: ReadonlySet<string>;
  onEvent: (event: AgentWireEvent) => void;
  flushEvents: () => Promise<void>;
  onUsage: AgentUsageListener;
  toApproval: (request: ApprovalRequest) => TApproval;
  persistApprovals: (approvals: readonly TApproval[]) => Promise<void>;
}

/**
 * A host's binding for one kind. `minTier` is eager because the guards read it before any
 * definition is loaded; `load` is a dynamic import because the definition pulls the domain
 * package and the provider stack, which must stay out of the boot path.
 */
export interface AgentKindEntry {
  readonly minTier: CallerTier;
  load(): Promise<AgentKindDefinition<unknown, object>>;
}

/** Refuses a definition whose discriminator drifted from the key it was registered under. */
export const assertAgentKind = (
  kind: string,
  definition: AgentKindDefinition<unknown, object>
): AgentKindDefinition<unknown, object> => {
  if (definition.kind !== kind) {
    throw new Error(
      `Agent kind "${kind}" loaded a definition for "${definition.kind}".`
    );
  }
  return definition;
};
