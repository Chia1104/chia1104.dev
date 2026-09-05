import { uuidv7 } from "@earendil-works/pi-ai";

import type { DB } from "@chia/db/client";
import {
  appendAgentSessionEntryAsLeaf,
  getAgentSession,
  getAgentSessionEntries,
  getAgentSessionEntriesByType,
  getAgentSessionEntry,
  updateAgentSession,
} from "@chia/db/repos/agent";
import type { JsonObject } from "@chia/utils/json";

import type { NewSessionEntry, SessionEntry, SessionStats } from "./entries.ts";
import { computeSessionStats } from "./entries.ts";
import type { SessionTree } from "./tree.ts";
import { labelOf, walkBranch } from "./tree.ts";

/** Session tree over `agent.session` and `agent.session_entry`. SQL lives in `@chia/db/repos/agent`. */

export interface PgSessionMetadata {
  id: string;
  /** ISO 8601. */
  createdAt: string;
  userId: string;
  kind: string;
}

interface EntryRow {
  seq: number;
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
    return row?.leafEntryId ?? null;
  }

  async setLeafId(leafId: string | null): Promise<void> {
    await updateAgentSession(this.db, this.id, { leafEntryId: leafId });
  }

  newEntryId(): string {
    return uuidv7();
  }

  /** The insert and the leaf advance are one transaction: an entry is never left outside every branch. */
  async appendEntry(entry: NewSessionEntry): Promise<SessionEntry> {
    const { id, parentId, timestamp, type, ...payload } = entry;
    const { seq } = await appendAgentSessionEntryAsLeaf(this.db, {
      id,
      sessionId: this.id,
      parentId: parentId ?? null,
      type,
      // SAFETY: Session entries contain only JSON-serializable transcript fields.
      payload: payload as JsonObject,
      timestamp: new Date(timestamp),
    });
    return { ...entry, seq };
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
    return walkBranch(await this.getEntries(), leafId);
  }

  async getEntries(): Promise<SessionEntry[]> {
    const rows = await getAgentSessionEntries(this.db, this.id);
    return rows.map(toEntry);
  }
}

/**
 * `payload` holds the entry minus the base fields; rehydrating is a spread. Base fields are
 * assigned after the spread so the projected shape never depends on column order.
 *
 * The payload is stored opaquely so an entry type this runtime has not modelled still
 * round-trips. Fields that became mandatory after rows were written are defaulted here rather
 * than migrated: a compaction without `retainedTail` reads back with an empty tail, which is how
 * the projection already treated it, and a summary without `fromHook` was written by this
 * runtime, never by a hook.
 */
const toEntry = (row: EntryRow): SessionEntry => {
  const entry =
    /* SAFETY: The row was written from a SessionEntry by appendEntry. */ {
      ...row.payload,
      id: row.id,
      parentId: row.parentId,
      seq: row.seq,
      type: row.type,
      timestamp: row.timestamp.getTime(),
    } as SessionEntry;
  if (entry.type === "compaction" && !Array.isArray(entry.retainedTail)) {
    entry.retainedTail = [];
  }
  if (entry.type === "compaction" || entry.type === "branch_summary") {
    entry.fromHook ??= false;
  }
  return entry;
};
