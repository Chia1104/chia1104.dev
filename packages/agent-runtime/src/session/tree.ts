import { uuidv7 } from "@earendil-works/pi-ai";

import type { NewSessionEntry, SessionEntry, SessionStats } from "./entries.ts";
import { computeSessionStats } from "./entries.ts";

/**
 * One session's tree of entries plus its active leaf.
 *
 * This is the whole persistence contract the runtime needs: a turn reads the branch under the
 * leaf, appends what the model and its tools produced, and compaction, navigation and forks move
 * or copy entries. Pi's `Agent` never sees it — it receives projected messages and hands back
 * events — so the tree can live wherever the host keeps its data.
 */
export interface SessionTree {
  readonly id: string;
  getLeafId(): Promise<string | null>;
  setLeafId(leafId: string | null): Promise<void>;
  /** Persists the entry, makes it the new leaf and returns it with the `seq` it landed on. */
  appendEntry(entry: NewSessionEntry): Promise<SessionEntry>;
  getEntry(id: string): Promise<SessionEntry | undefined>;
  /** Every entry in `seq` order, all branches. */
  getEntries(): Promise<SessionEntry[]>;
  findEntries<TType extends SessionEntry["type"]>(
    type: TType
  ): Promise<Extract<SessionEntry, { type: TType }>[]>;
  /**
   * Root-first path from `fromId` to the root, stopping at the newest compaction, which
   * summarises everything before it. `undefined` starts at the leaf; `null` is the empty branch.
   */
  getBranch(fromId?: string | null): Promise<SessionEntry[]>;
  getLabel(id: string): Promise<string | undefined>;
  getSessionName(): Promise<string | undefined>;
  getSessionStats(): Promise<SessionStats>;
  /**
   * uuidv7 rather than a serial: entry ids surface in the event stream and in fork targets, and
   * time-ordered-but-opaque beats enumerable.
   */
  newEntryId(): string;
}

const walkPath = (
  entries: readonly SessionEntry[],
  leafId: string | null,
  stopAt: (entry: SessionEntry) => boolean
): SessionEntry[] => {
  if (!leafId) return [];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  const path: SessionEntry[] = [];
  const seen = new Set<string>();
  let cursor: string | null = leafId;

  while (cursor) {
    // Cycles cannot happen through the append path, but a corrupt parentId must not hang.
    if (seen.has(cursor)) break;
    seen.add(cursor);

    const entry = byId.get(cursor);
    if (!entry) break;
    path.push(entry);
    if (stopAt(entry)) break;
    cursor = entry.parentId;
  }

  return path.reverse();
};

const isCompaction = (entry: SessionEntry) => entry.type === "compaction";

/**
 * Walks `parentId` from `leafId` and returns the branch root-first, stopping at the newest
 * compaction: what the model's context is built from. Shared by every backend.
 */
export const walkBranch = (
  entries: readonly SessionEntry[],
  leafId: string | null
): SessionEntry[] => walkPath(entries, leafId, isCompaction);

/**
 * The leaf's whole ancestry, root-first, through every compaction: what the operator sees. A
 * compaction condenses what the model is sent, not what was said, so the transcript keeps the
 * messages behind it and shows the compaction where it happened.
 */
export const walkTranscript = (
  entries: readonly SessionEntry[],
  leafId: string | null
): SessionEntry[] => walkPath(entries, leafId, () => false);

/** Last write wins, matching the label semantics Pi's JSONL sessions had. */
export const labelOf = (
  labels: readonly Extract<SessionEntry, { type: "label" }>[],
  targetId: string
): string | undefined => {
  let label: string | undefined;
  for (const entry of labels) {
    if (entry.targetId === targetId) label = entry.label;
  }
  return label;
};

/** The tree in memory, for tests and any caller that never needs the transcript to outlive it. */
export class InMemorySessionTree implements SessionTree {
  private readonly entries: SessionEntry[] = [];
  private leafId: string | null = null;
  private name: string | undefined;

  constructor(
    readonly id: string,
    options: { name?: string } = {}
  ) {
    this.name = options.name;
  }

  getLeafId(): Promise<string | null> {
    return Promise.resolve(this.leafId);
  }

  setLeafId(leafId: string | null): Promise<void> {
    this.leafId = leafId;
    return Promise.resolve();
  }

  appendEntry(entry: NewSessionEntry): Promise<SessionEntry> {
    const stored: SessionEntry = { ...entry, seq: this.entries.length + 1 };
    this.entries.push(stored);
    this.leafId = stored.id;
    return Promise.resolve(stored);
  }

  getEntry(id: string): Promise<SessionEntry | undefined> {
    return Promise.resolve(this.entries.find((entry) => entry.id === id));
  }

  getEntries(): Promise<SessionEntry[]> {
    return Promise.resolve([...this.entries]);
  }

  findEntries<TType extends SessionEntry["type"]>(
    type: TType
  ): Promise<Extract<SessionEntry, { type: TType }>[]> {
    return Promise.resolve(
      this.entries.filter(
        (entry): entry is Extract<SessionEntry, { type: TType }> =>
          entry.type === type
      )
    );
  }

  getBranch(fromId?: string | null): Promise<SessionEntry[]> {
    const start = fromId === undefined ? this.leafId : fromId;
    return Promise.resolve(walkBranch(this.entries, start));
  }

  async getLabel(id: string): Promise<string | undefined> {
    return labelOf(await this.findEntries("label"), id);
  }

  getSessionName(): Promise<string | undefined> {
    return Promise.resolve(this.name);
  }

  getSessionStats(): Promise<SessionStats> {
    return Promise.resolve(computeSessionStats(this.entries));
  }

  newEntryId(): string {
    return uuidv7();
  }
}
