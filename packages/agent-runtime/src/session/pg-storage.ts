import { Session, uuidv7 } from "@earendil-works/pi-agent-core";
import type {
  SessionEntryCursorOptions,
  SessionMetadata,
  SessionStats,
  SessionStorage,
  SessionTreeEntry,
} from "@earendil-works/pi-agent-core";

import type { DB } from "@chia/db/client";
import {
  appendAgentSessionEntry,
  getAgentSession,
  getAgentSessionEntries,
  getAgentSessionEntriesByType,
  getAgentSessionEntry,
  updateAgentSession,
} from "@chia/db/repos/agent";
import type { JsonObject } from "@chia/utils/json";

/**
 * Pi's {@link SessionStorage} over `agent.session_entry`.
 *
 * The port is only 12 methods, so this is far less work than pulling in
 * `@earendil-works/pi-storage-sqlite-node` and running a second datastore next to the one the
 * dashboard already queries. All SQL lives in `@chia/db/repos/agent`.
 */

export interface PgSessionMetadata extends SessionMetadata {
  userId: string;
  kind: string;
}

interface EntryRow {
  id: string;
  parentId: string | null;
  type: string;
  payload: JsonObject;
  timestamp: Date;
}

export class PgSessionStorage implements SessionStorage<PgSessionMetadata> {
  constructor(
    private readonly db: DB,
    private readonly sessionId: string,
    private readonly metadata: PgSessionMetadata
  ) {}

  getMetadata(): Promise<PgSessionMetadata> {
    return Promise.resolve(this.metadata);
  }

  async getLeafId(): Promise<string | null> {
    const row = await getAgentSession(this.db, this.sessionId);
    if (row?.leafEntryId) return row.leafEntryId;

    // Compatibility for entries written before appendEntry advanced the leaf. That bug produced a
    // flat sequence where every entry was a root. A normal branch can have a null leaf after an
    // explicit move-to-root, but its existing entries still contain parent links.
    const entries = await getAgentSessionEntries(this.db, this.sessionId);
    if (
      entries.length > 1 &&
      entries.every((entry) => entry.parentId === null)
    ) {
      return entries.at(-1)?.id ?? null;
    }
    return null;
  }

  async setLeafId(leafId: string | null): Promise<void> {
    await updateAgentSession(this.db, this.sessionId, { leafEntryId: leafId });
  }

  /**
   * uuidv7 rather than a serial: entry ids surface in the event stream and in fork targets, and
   * time-ordered-but-opaque beats enumerable.
   */
  createEntryId(): Promise<string> {
    return Promise.resolve(uuidv7());
  }

  async appendEntry(entry: SessionTreeEntry): Promise<void> {
    const { id, parentId, timestamp, type, ...payload } = entry;
    await appendAgentSessionEntry(this.db, {
      id,
      sessionId: this.sessionId,
      parentId: parentId ?? null,
      type,
      // SAFETY: Pi session entries contain only JSON-serializable transcript fields.
      payload: payload as JsonObject,
      timestamp: new Date(timestamp),
    });

    // pi's in-memory and JSONL adapters advance the active leaf whenever an entry is appended.
    // Keep the PostgreSQL adapter behaviorally equivalent: getBranch() starts from this cursor,
    // so leaving it null makes a persisted transcript look empty after the process is recreated.
    await this.setLeafId(id);
  }

  async getEntry(id: string): Promise<SessionTreeEntry | undefined> {
    const row = await getAgentSessionEntry(this.db, this.sessionId, id);
    return row ? toEntry(row) : undefined;
  }

  async findEntries<TType extends SessionTreeEntry["type"]>(
    type: TType
  ): Promise<Extract<SessionTreeEntry, { type: TType }>[]> {
    const rows = await getAgentSessionEntriesByType(
      this.db,
      this.sessionId,
      type
    );
    return /* SAFETY: The producer contract guarantees this value satisfies Extract<SessionTreeEntry, { type: TType }>[]. */ rows.map(
      toEntry
    ) as Extract<SessionTreeEntry, { type: TType }>[];
  }

  async getLabel(id: string): Promise<string | undefined> {
    const labels = await this.findEntries("label");
    // Last write wins, matching pi's own JSONL semantics.
    let label: string | undefined;
    for (const entry of labels) {
      if (entry.targetId === id) label = entry.label;
    }
    return label;
  }

  async getSessionName(): Promise<string | undefined> {
    const row = await getAgentSession(this.db, this.sessionId);
    return row?.title ?? undefined;
  }

  /**
   * Aggregated from provider-reported assistant, compaction and branch-summary usage. Summed as
   * per-call figures rather than reading the last message, so a compacted session still reports
   * everything it actually processed and cost.
   */
  async getSessionStats(): Promise<SessionStats> {
    const entries = await this.getEntries();
    const stats: SessionStats = {
      messageCount: 0,
      cachedTokens: 0,
      uncachedTokens: 0,
      totalTokens: 0,
      costTotal: 0,
    };

    for (const entry of entries) {
      if (entry.type === "message") stats.messageCount += 1;
      const usage =
        entry.type === "message"
          ? entry.message.role === "assistant"
            ? entry.message.usage
            : undefined
          : entry.type === "compaction" || entry.type === "branch_summary"
            ? entry.usage
            : undefined;
      if (!usage) continue;
      stats.cachedTokens += usage.cacheRead;
      stats.uncachedTokens += usage.input + usage.cacheWrite;
      stats.totalTokens +=
        usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
      stats.costTotal += usage.cost.total;
    }

    return stats;
  }

  /**
   * Walks `parentId` from the leaf to the root (or to the newest compaction, which acts as a
   * horizon) and returns the branch root-first.
   *
   * Loads the whole session and walks in memory rather than issuing a recursive CTE: a writing
   * session is hundreds of entries, not millions, so one query beats N round trips.
   */
  async getPathToRootOrCompaction(
    leafId: string | null
  ): Promise<SessionTreeEntry[]> {
    if (!leafId) return [];

    const rows = await getAgentSessionEntries(this.db, this.sessionId);
    const entries = rows.map(toEntry);

    // The old PostgreSQL adapter persisted every entry with a null parent because its leaf never
    // advanced. Reconstruct only that contiguous root prefix in memory. A legitimate branch made
    // after move-to-root occurs after linked entries, so it is intentionally left untouched.
    for (let index = 1; index < entries.length; index += 1) {
      const entry = entries[index];
      const previous = entries[index - 1];
      if (!entry || !previous || entry.parentId !== null) break;
      entries[index] = { ...entry, parentId: previous.id };
    }

    const byId = new Map(entries.map((entry) => [entry.id, entry]));

    const path: SessionTreeEntry[] = [];
    const seen = new Set<string>();
    let cursor: string | null = leafId;

    while (cursor) {
      // Cycles cannot happen through the append path, but a corrupt parentId must not hang.
      if (seen.has(cursor)) break;
      seen.add(cursor);

      const entry = byId.get(cursor);
      if (!entry) break;
      path.push(entry);
      // A compaction summarises everything before it, so the branch stops here.
      if (entry.type === "compaction") break;
      cursor = entry.parentId;
    }

    return path.reverse();
  }

  async getEntries(
    options?: SessionEntryCursorOptions
  ): Promise<SessionTreeEntry[]> {
    const rows = await getAgentSessionEntries(this.db, this.sessionId, {
      afterSeq: options?.afterEntrySeq,
      limit: options?.limit,
    });
    return rows.map(toEntry);
  }
}

/**
 * `payload` holds the entry minus the four base fields, so rehydrating is a spread.
 *
 * The cast is deliberate: the entry union belongs to pi and is stored opaquely so that a pi
 * upgrade adding an entry type needs no migration here.
 */
const toEntry = (row: EntryRow): SessionTreeEntry =>
  /* SAFETY: The producer contract guarantees this value satisfies SessionTreeEntry. */ ({
    ...row.payload,
    id: row.id,
    parentId: row.parentId,
    type: row.type,
    timestamp: row.timestamp.toISOString(),
  }) as SessionTreeEntry;

/** Wraps the storage in pi's `Session` tree API. */
export const toPgSession = (
  db: DB,
  sessionId: string,
  metadata: PgSessionMetadata
): Session<PgSessionMetadata> =>
  new Session(new PgSessionStorage(db, sessionId, metadata));
