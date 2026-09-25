import { uuidv7 } from "@earendil-works/pi-ai";

import type { DB } from "@chia/db/client";
import {
  createAgentSession,
  getAgentSessions,
  updateAgentSession,
} from "@chia/db/repos/agent";
import type { AgentSession } from "@chia/db/schema";
import { isEnumValue } from "@chia/utils/is";
import type { JsonObject } from "@chia/utils/json";

import { modelRefOf } from "../models.ts";
import type { AgentModelRef } from "../models.ts";
import { ThinkingLevel } from "../types.ts";
import type { AgentSessionDefaults, AgentSessionSettings } from "../types.ts";

import { PgSessionStorage } from "./pg-storage.ts";

/** What opening a session needs from its row; the caller has already loaded and authorized it. */
export type PgSessionRow = Pick<
  AgentSession,
  "id" | "createdAt" | "userId" | "kind"
>;

export interface PgSessionCreateOptions {
  id?: string;
  userId: string;
  title?: string;
  /** The row names a model only when `settings` does; otherwise it follows the kind default. */
  settings?: Partial<AgentSessionSettings>;
  /** Fills the thinking level and approvals `settings` leaves out. */
  defaults: Pick<AgentSessionDefaults, "thinkingLevel" | "autoApprove">;
  runtimeConfig?: JsonObject;
  configVersion?: number;
  /** Lineage recorded on the row; set by `fork`. */
  forkedFrom?: { sessionId: string; entryId: string | null };
}

export interface PgSessionListOptions {
  userId: string;
  limit?: number;
}

export interface PgSessionForkOptions extends Partial<
  Omit<PgSessionCreateOptions, "defaults">
> {
  /** Entry to fork from; the whole tree when omitted. */
  entryId?: string;
  /** `before` forks the branch up to the user message's parent, so the message can be re-asked. */
  position?: "before" | "at";
}

export class SessionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionNotFoundError";
  }
}

/**
 * Session lifecycle over `agent.session`.
 *
 * `fork` copies the prefix into a new session row so the original branch stays readable in the
 * dashboard.
 */
export class PgSessionRepo {
  /** Scoped to one kind, so list and open are safe by construction. */
  constructor(
    private readonly db: DB,
    private readonly kind: string
  ) {}

  async create(options: PgSessionCreateOptions): Promise<PgSessionStorage> {
    const id = options.id ?? uuidv7();
    const { kind } = this;
    const { defaults } = options;
    const settings = options.settings ?? {};

    await createAgentSession(this.db, {
      id,
      userId: options.userId,
      kind,
      title: options.title ?? null,
      providerId: settings.providerId ?? null,
      modelId: settings.modelId ?? null,
      thinkingLevel: settings.thinkingLevel ?? defaults.thinkingLevel ?? "off",
      activeToolNames: settings.activeToolNames ?? null,
      autoApprove: settings.autoApprove ?? defaults.autoApprove ?? [],
      runtimeConfig: options.runtimeConfig,
      configVersion: options.configVersion,
      forkedFromSessionId: options.forkedFrom?.sessionId ?? null,
      forkedFromEntryId: options.forkedFrom?.entryId ?? null,
    });

    return new PgSessionStorage(this.db, {
      id,
      createdAt: new Date().toISOString(),
      userId: options.userId,
      kind,
    });
  }

  open(row: PgSessionRow): PgSessionStorage {
    if (row.kind !== this.kind) {
      throw new SessionNotFoundError(
        `Session ${row.id} belongs to agent kind "${row.kind}", not "${this.kind}"`
      );
    }
    return new PgSessionStorage(this.db, {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      userId: row.userId,
      kind: row.kind,
    });
  }

  /** The caller's live sessions of this kind, newest activity first; each row can be opened. */
  list(options: PgSessionListOptions): Promise<AgentSession[]> {
    return getAgentSessions(this.db, { ...options, kind: this.kind });
  }

  /** `source` must be read in the transaction that holds the session lock: its leaf is copied. */
  async fork(
    source: AgentSession,
    options: PgSessionForkOptions
  ): Promise<PgSessionStorage> {
    const entries = await entriesToFork(this.open(source), options);
    const sourceSettings = ownSettingsOf(source);

    const forked = await this.create({
      id: options.id,
      userId: options.userId ?? source.userId,
      title: options.title ?? source.title ?? undefined,
      settings: options.settings ?? sourceSettings,
      defaults: sourceSettings,
      forkedFrom: {
        sessionId: source.id,
        entryId: options.entryId ?? source.leafEntryId,
      },
    });

    // appendEntry advances the leaf, so a branch fork ends on its last copied entry. Copies are
    // appended in the source's `seq` order and take fresh seqs in the new session.
    for (const { seq: _seq, ...entry } of entries) {
      await forked.appendEntry(entry);
    }
    // A whole-tree fork copies every branch in insertion order; the newest entry is not the
    // active one when the source was rewound, so the fork takes the source's leaf explicitly.
    if (!options.entryId) await forked.setLeafId(source.leafEntryId);

    return forked;
  }
}

/**
 * What a fork copies: the whole tree when no target is given, otherwise the branch below
 * `entryId` from the newest compaction down.
 * `before` only makes sense on a user message, whose parent becomes the effective leaf.
 */
const entriesToFork = async (
  session: PgSessionStorage,
  options: Pick<PgSessionForkOptions, "entryId" | "position">
) => {
  if (!options.entryId) return session.getEntries();
  const target = await session.getEntry(options.entryId);
  if (!target) {
    throw new SessionNotFoundError(`Entry ${options.entryId} not found`);
  }
  if ((options.position ?? "before") === "at") {
    return session.getBranch(target.id);
  }
  if (target.type !== "message" || target.message.role !== "user") {
    throw new Error(`Entry ${options.entryId} is not a user message`);
  }
  return session.getBranch(target.parentId);
};

export interface SessionSettingsPatch extends Partial<
  Omit<AgentSessionSettings, "providerId" | "modelId">
> {
  /** `null` clears the pair so the session follows the kind default again. */
  model?: AgentModelRef | null;
  title?: string;
  runtimeConfig?: JsonObject;
}

export const writeSessionSettings = async (
  db: DB,
  sessionId: string,
  patch: SessionSettingsPatch
): Promise<void> => {
  await updateAgentSession(db, sessionId, {
    providerId:
      patch.model === undefined ? undefined : (patch.model?.providerId ?? null),
    modelId:
      patch.model === undefined ? undefined : (patch.model?.modelId ?? null),
    thinkingLevel: patch.thinkingLevel,
    activeToolNames: patch.activeToolNames,
    autoApprove: patch.autoApprove,
    title: patch.title,
    runtimeConfig: patch.runtimeConfig,
  });
};

interface SessionSettingsRow {
  id: string;
  providerId: string | null;
  modelId: string | null;
  thinkingLevel: string | null;
  activeToolNames: string[] | null;
  autoApprove: string[];
}

/**
 * Runtime settings live on the session row rather than as tree entries: the transport needs
 * the current values before a turn exists in order to build one. Every reader goes through
 * here, so an incomplete row fails the same way everywhere.
 * A row that names no model runs on `house`, the kind's effective default as read for this
 * call, so an operator's change reaches every such session on its next turn.
 */
export const settingsFromRow = (
  row: SessionSettingsRow,
  house: AgentModelRef
): AgentSessionSettings => {
  const model = modelRefOf(row) ?? house;
  return {
    ...ownSettingsOf(row),
    providerId: model.providerId,
    modelId: model.modelId,
  };
};

/** The row's own settings: the model only when the row names one. */
export const ownSettingsOf = (
  row: SessionSettingsRow
): Omit<AgentSessionSettings, "providerId" | "modelId"> &
  Partial<AgentModelRef> => {
  if (!row.thinkingLevel || !isEnumValue(ThinkingLevel, row.thinkingLevel)) {
    throw new Error(`Agent session ${row.id} has incomplete LLM settings.`);
  }
  return {
    ...modelRefOf(row),
    thinkingLevel: row.thinkingLevel,
    activeToolNames: row.activeToolNames,
    autoApprove: row.autoApprove,
  };
};
