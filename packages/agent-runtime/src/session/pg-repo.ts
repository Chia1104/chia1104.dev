import { uuidv7 } from "@earendil-works/pi-ai";

import type { DB } from "@chia/db/client";
import {
  createAgentSession,
  getAgentSession,
  getAgentSessions,
  softDeleteAgentSession,
  updateAgentSession,
} from "@chia/db/repos/agent";
import type { JsonObject } from "@chia/utils/json";

import type {
  AgentSessionDefaults,
  AgentSessionSettings,
  ThinkingLevel,
  ToolTier,
} from "../types.ts";

import { PgSessionStorage } from "./pg-storage.ts";
import type { PgSessionMetadata } from "./pg-storage.ts";

export interface PgSessionCreateOptions {
  id?: string;
  userId: string;
  title?: string;
  settings?: Partial<AgentSessionSettings>;
  runtimeConfig?: JsonObject;
  configVersion?: number;
}

export interface PgSessionListOptions {
  userId: string;
  limit?: number;
  includeDeleted?: boolean;
}

export interface PgSessionForkOptions extends Partial<PgSessionCreateOptions> {
  /** Entry to fork from; the whole tree when omitted. */
  entryId?: string;
  /** `before` forks the branch up to the user message's parent, so the message can be re-asked. */
  position?: "before" | "at";
}

export interface PgSessionRepoOptions {
  kind: string;
  defaults: AgentSessionDefaults;
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
 * `fork` is the interesting one — it powers "rewind three steps and try another angle". The copied
 * prefix lands in a *new* session row so the original branch stays readable in the dashboard.
 */
export class PgSessionRepo {
  /**
   * The repository is scoped to one kind. That makes list/open safe by construction and keeps
   * defaults owned by the kind rather than by core.
   */
  constructor(
    private readonly db: DB,
    private readonly options: PgSessionRepoOptions
  ) {}

  async create(options: PgSessionCreateOptions): Promise<PgSessionStorage> {
    const id = options.id ?? uuidv7();
    const { kind, defaults } = this.options;
    const settings = options.settings ?? {};

    await createAgentSession(this.db, {
      id,
      userId: options.userId,
      kind,
      title: options.title ?? null,
      providerId: settings.providerId ?? defaults.providerId,
      modelId: settings.modelId ?? defaults.modelId,
      thinkingLevel: settings.thinkingLevel ?? defaults.thinkingLevel ?? "off",
      activeToolNames: settings.activeToolNames ?? null,
      autoApprove: settings.autoApprove ?? [],
      runtimeConfig: options.runtimeConfig,
      configVersion: options.configVersion,
    });

    return new PgSessionStorage(this.db, {
      id,
      createdAt: new Date().toISOString(),
      userId: options.userId,
      kind,
    });
  }

  async open(
    metadata: Pick<PgSessionMetadata, "id">
  ): Promise<PgSessionStorage> {
    const { session } = await this.load(metadata.id);
    return session;
  }

  /** The row and its tree together; `fork` needs both and must not read the row twice. */
  private async load(sessionId: string) {
    const row = await getAgentSession(this.db, sessionId);
    if (!row) {
      throw new SessionNotFoundError(`Session not found: ${sessionId}`);
    }
    if (row.kind !== this.options.kind) {
      throw new SessionNotFoundError(
        `Session ${sessionId} belongs to agent kind "${row.kind}", not "${this.options.kind}"`
      );
    }
    const session = new PgSessionStorage(this.db, {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      userId: row.userId,
      kind: row.kind,
    });
    return { row, session };
  }

  /** Opens by id — what the transport actually holds, without a metadata round-trip. */
  openById(sessionId: string): Promise<PgSessionStorage> {
    return this.open({ id: sessionId });
  }

  async list(options?: PgSessionListOptions): Promise<PgSessionMetadata[]> {
    if (!options) return [];
    const rows = await getAgentSessions(this.db, {
      ...options,
      kind: this.options.kind,
    });
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      userId: row.userId,
      kind: row.kind,
    }));
  }

  /**
   * Soft delete. A transcript is worth keeping after an operator clears a session from the
   * list — a hard delete cascades the whole tree away.
   */
  async delete(metadata: Pick<PgSessionMetadata, "id">): Promise<void> {
    await softDeleteAgentSession(this.db, metadata.id);
  }

  async fork(
    source: Pick<PgSessionMetadata, "id">,
    options: PgSessionForkOptions
  ): Promise<PgSessionStorage> {
    const { row: sourceRow, session: original } = await this.load(source.id);
    const entries = await entriesToFork(original, options);

    const forked = await this.create({
      id: options.id,
      userId: options.userId ?? sourceRow.userId,
      title: options.title ?? sourceRow.title ?? undefined,
      settings: options.settings ?? settingsFromRow(sourceRow),
    });

    // appendEntry advances the leaf, so a branch fork ends on its last copied entry.
    for (const entry of entries) {
      await forked.appendEntry(entry);
    }
    // A whole-tree fork copies every branch in insertion order; the newest entry is not the
    // active one when the source was rewound, so the fork takes the source's leaf explicitly.
    if (!options.entryId) await forked.setLeafId(sourceRow.leafEntryId);

    return forked;
  }
}

/**
 * What a fork copies: the whole tree when no target is given, otherwise the branch below
 * `entryId` from the newest compaction down. `before` only makes sense on a user message, whose
 * parent becomes the effective leaf.
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

// ============================================
// Session settings (outside the tree)
// ============================================

/**
 * Runtime settings are read and written directly rather than as tree entries: the transport
 * needs the current values *before* a turn exists in order to build one.
 */
export const readSessionSettings = async (
  db: DB,
  sessionId: string
): Promise<AgentSessionSettings | null> => {
  const row = await getAgentSession(db, sessionId);
  if (!row) return null;
  return settingsFromRow(row);
};

export const writeSessionSettings = async (
  db: DB,
  sessionId: string,
  patch: Partial<AgentSessionSettings> & {
    title?: string;
    runtimeConfig?: JsonObject;
  }
): Promise<void> => {
  await updateAgentSession(db, sessionId, {
    providerId: patch.providerId,
    modelId: patch.modelId,
    thinkingLevel: patch.thinkingLevel,
    activeToolNames: patch.activeToolNames,
    autoApprove: patch.autoApprove,
    title: patch.title,
    runtimeConfig: patch.runtimeConfig,
  });
};

const settingsFromRow = (row: {
  id: string;
  providerId: string | null;
  modelId: string | null;
  thinkingLevel: string | null;
  activeToolNames: string[] | null;
  autoApprove: string[];
}): AgentSessionSettings => {
  if (!row.providerId || !row.modelId || !row.thinkingLevel) {
    throw new Error(`Session ${row.id} has no LLM settings for this runtime`);
  }
  return {
    providerId: row.providerId,
    modelId: row.modelId,
    thinkingLevel:
      /* SAFETY: The producer contract guarantees this value satisfies ThinkingLevel. */ row.thinkingLevel as ThinkingLevel,
    activeToolNames: row.activeToolNames,
    autoApprove:
      /* SAFETY: The producer contract guarantees this value satisfies ToolTier[]. */ row.autoApprove as ToolTier[],
  };
};
