import {
  createTimestamp,
  getEntriesToFork,
  SessionError,
  toSession,
  uuidv7,
} from "@earendil-works/pi-agent-core";
import type {
  Session,
  SessionCreateOptions,
  SessionForkOptions,
  SessionRepo,
} from "@earendil-works/pi-agent-core";

import type { DB } from "@chia/db";
import type { JsonObject } from "@chia/db/json";
import {
  createAgentSession,
  getAgentSession,
  getAgentSessions,
  softDeleteAgentSession,
  updateAgentSession,
} from "@chia/db/repos/agent";

import type {
  AgentSessionDefaults,
  AgentSessionSettings,
  ThinkingLevel,
  ToolTier,
} from "../types.ts";

import { PgSessionStorage } from "./pg-storage.ts";
import type { PgSessionMetadata } from "./pg-storage.ts";

export interface PgSessionCreateOptions extends SessionCreateOptions {
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

export interface PgSessionRepoOptions {
  kind: string;
  defaults: AgentSessionDefaults;
}

/**
 * Pi's {@link SessionRepo} over `agent_session`.
 *
 * `fork` is the interesting one — it powers "rewind three steps and try another angle". pi's
 * `getEntriesToFork` picks the prefix to copy, and the copy lands in a *new* session row so the
 * original branch stays readable in the dashboard.
 */
export class PgSessionRepo implements SessionRepo<
  PgSessionMetadata,
  PgSessionCreateOptions,
  PgSessionListOptions
> {
  /**
   * The repository is scoped to one kind. That makes list/open safe by construction and keeps
   * defaults owned by the kind rather than by core.
   */
  constructor(
    private readonly db: DB,
    private readonly options: PgSessionRepoOptions
  ) {}

  async create(
    options: PgSessionCreateOptions
  ): Promise<Session<PgSessionMetadata>> {
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

    return toSession(
      new PgSessionStorage(this.db, id, {
        id,
        createdAt: createTimestamp(),
        userId: options.userId,
        kind,
      })
    );
  }

  async open(
    metadata: Pick<PgSessionMetadata, "id">
  ): Promise<Session<PgSessionMetadata>> {
    const row = await getAgentSession(this.db, metadata.id);
    if (!row) {
      throw new SessionError("not_found", `Session not found: ${metadata.id}`);
    }
    if (row.kind !== this.options.kind) {
      throw new SessionError(
        "not_found",
        `Session ${metadata.id} belongs to agent kind "${row.kind}", not "${this.options.kind}"`
      );
    }
    return toSession(
      new PgSessionStorage(this.db, row.id, {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        userId: row.userId,
        kind: row.kind,
      })
    );
  }

  /** Opens by id — what the transport actually holds, without a metadata round-trip. */
  openById(sessionId: string): Promise<Session<PgSessionMetadata>> {
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
    options: SessionForkOptions & Partial<PgSessionCreateOptions>
  ): Promise<Session<PgSessionMetadata>> {
    const original = await this.open(source);
    const entries = await getEntriesToFork(original.getStorage(), {
      entryId: options.entryId,
      position: options.position,
    });

    const sourceRow = await getAgentSession(this.db, source.id);
    if (!sourceRow) {
      throw new SessionError("not_found", `Session not found: ${source.id}`);
    }

    const forked = await this.create({
      id: options.id,
      userId: options.userId ?? sourceRow.userId,
      title: options.title ?? sourceRow.title ?? undefined,
      settings: options.settings ?? settingsFromRow(sourceRow),
    });

    const storage = forked.getStorage();
    for (const entry of entries) {
      await storage.appendEntry(entry);
    }
    const leaf = entries.at(-1);
    if (leaf) await storage.setLeafId(leaf.id);

    return forked;
  }
}

// ============================================
// Session settings (outside pi's port)
// ============================================

/**
 * Runtime settings are read and written directly rather than through `SessionStorage`.
 *
 * pi models model/thinking changes as session *entries* for replay fidelity, but the transport
 * needs the current values *before* a harness exists in order to build one.
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
    throw new Error(`Session ${row.id} has no LLM settings for this harness`);
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
