import { uuidv7 } from "@earendil-works/pi-ai";

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

import type { SessionEntry, SessionStats } from "./entries.ts";
import { computeSessionStats } from "./entries.ts";
import type { SessionTree } from "./tree.ts";
import { labelOf, walkBranch } from "./tree.ts";

/**
 * The session tree over `agent.session` and `agent.session_entry`. All SQL lives in
 * `@chia/db/repos/agent`.
 */

export interface PgSessionMetadata {
  id: string;
  /** ISO 8601. */
  createdAt: string;
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

export class PgSessionStorage implements SessionTree {
  constructor(
    private readonly db: DB,
    readonly metadata: PgSessionMetadata
  ) {}

  get id(): string {
    return this.metadata.id;
  }

  async getLeafId(): Promise<string | null> {
    const row = await getAgentSession(this.db, this.id);
    if (row?.leafEntryId) return row.leafEntryId;

    // Compatibility for entries written before appendEntry advanced the leaf. That bug produced a
    // flat sequence where every entry was a root. A normal branch can have a null leaf after an
    // explicit move-to-root, but its existing entries still contain parent links.
    const entries = await getAgentSessionEntries(this.db, this.id);
    if (
      entries.length > 1 &&
      entries.every((entry) => entry.parentId === null)
    ) {
      return entries.at(-1)?.id ?? null;
    }
    return null;
  }

  async setLeafId(leafId: string | null): Promise<void> {
    await updateAgentSession(this.db, this.id, { leafEntryId: leafId });
  }

  newEntryId(): string {
    return uuidv7();
  }

  async appendEntry(entry: SessionEntry): Promise<void> {
    const { id, parentId, timestamp, type, ...payload } = entry;
    await appendAgentSessionEntry(this.db, {
      id,
      sessionId: this.id,
      parentId: parentId ?? null,
      type,
      // SAFETY: Session entries contain only JSON-serializable transcript fields.
      payload: payload as JsonObject,
      timestamp: new Date(timestamp),
    });

    // getBranch() starts from this cursor, so leaving it behind makes a persisted transcript look
    // empty after the process is recreated.
    await this.setLeafId(id);
  }

  async getEntry(id: string): Promise<SessionEntry | undefined> {
    const row = await getAgentSessionEntry(this.db, this.id, id);
    return row ? toEntry(row) : undefined;
  }

  async findEntries<TType extends SessionEntry["type"]>(
    type: TType
  ): Promise<Extract<SessionEntry, { type: TType }>[]> {
    const rows = await getAgentSessionEntriesByType(this.db, this.id, type);
    return /* SAFETY: The rows were selected by this discriminant. */ rows.map(
      toEntry
    ) as Extract<SessionEntry, { type: TType }>[];
  }

  async getLabel(id: string): Promise<string | undefined> {
    return labelOf(await this.findEntries("label"), id);
  }

  async getSessionName(): Promise<string | undefined> {
    const row = await getAgentSession(this.db, this.id);
    return row?.title ?? undefined;
  }

  async getSessionStats(): Promise<SessionStats> {
    return computeSessionStats(await this.getEntries());
  }

  /**
   * Loads the whole session and walks in memory rather than issuing a recursive CTE: a writing
   * session is hundreds of entries, not millions, so one query beats N round trips.
   */
  async getBranch(fromId?: string | null): Promise<SessionEntry[]> {
    const leafId = fromId === undefined ? await this.getLeafId() : fromId;
    if (!leafId) return [];

    const rows = await getAgentSessionEntries(this.db, this.id);
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

    return walkBranch(entries, leafId);
  }

  async getEntries(options?: {
    afterSeq?: number;
    limit?: number;
  }): Promise<SessionEntry[]> {
    const rows = await getAgentSessionEntries(this.db, this.id, options);
    return rows.map(toEntry);
  }
}

/**
 * `payload` holds the entry minus the four base fields, so rehydrating is a spread. Base fields
 * are assigned after the spread so the projected shape never depends on column order.
 *
 * The cast is deliberate: the payload is stored opaquely so an entry type this runtime has not
 * modelled still round-trips. A compaction persisted before `retainedTail` was mandatory reads
 * back with an empty tail, which is how the projection already treated it.
 */
const toEntry = (row: EntryRow): SessionEntry => {
  const entry =
    /* SAFETY: The row was written from a SessionEntry by appendEntry. */ {
      ...row.payload,
      id: row.id,
      parentId: row.parentId,
      type: row.type,
      timestamp: row.timestamp.getTime(),
    } as SessionEntry;
  if (entry.type === "compaction" && !Array.isArray(entry.retainedTail)) {
    entry.retainedTail = [];
  }
  return entry;
};
