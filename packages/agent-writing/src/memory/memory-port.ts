import type { MemoryPort } from "../ports.ts";
import type {
  MemoryDetail,
  MemoryHit,
  MemorySearchInput,
  MemorySummary,
  SavedMemory,
  SaveMemoryInput,
} from "../types.ts";

interface StoredMemory extends MemoryDetail {
  sessionId: string | null;
}

/**
 * In-memory {@link MemoryPort}. For tests and for driving the engine against pi-ai's `faux`
 * provider without a database. Search is a case-insensitive substring match over title and
 * content — the shape of the real port, not its ranking.
 */
export class InMemoryMemoryPort implements MemoryPort {
  private readonly rows = new Map<number, StoredMemory>();
  private nextId = 1;

  constructor(private readonly sessionId: string | null = null) {}

  /** Every stored row, for assertions. */
  get all(): StoredMemory[] {
    return [...this.rows.values()];
  }

  save(input: SaveMemoryInput): Promise<SavedMemory> {
    const now = new Date().toISOString();
    const sourceUrl = input.sourceUrl ?? null;

    // a `source` is keyed on its URL, like the partial unique index in Postgres
    const existing =
      input.kind === "source" && sourceUrl
        ? this.all.find(
            (row) => row.kind === "source" && row.sourceUrl === sourceUrl
          )
        : undefined;
    if (existing) {
      const changed =
        existing.title !== input.title || existing.content !== input.content;
      const next = {
        ...existing,
        title: input.title,
        content: input.content,
        updatedAt: now,
      };
      this.rows.set(existing.id, next);
      return Promise.resolve({ ...summaryOf(next), changed });
    }

    const row: StoredMemory = {
      id: this.nextId++,
      kind: input.kind,
      status: "active",
      title: input.title,
      content: input.content,
      sourceUrl,
      sessionId: this.sessionId,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return Promise.resolve({ ...summaryOf(row), changed: true });
  }

  search(input: MemorySearchInput): Promise<MemoryHit[]> {
    const query = input.query.trim().toLowerCase();
    if (!query) return Promise.resolve([]);
    const hits = this.all
      .filter((row) => row.status !== "archived")
      .filter(
        (row) =>
          row.title.toLowerCase().includes(query) ||
          row.content.toLowerCase().includes(query)
      )
      .slice(0, input.limit)
      .map((row) => ({ ...summaryOf(row), snippet: row.content }));
    return Promise.resolve(hits);
  }

  get(id: number): Promise<MemoryDetail | null> {
    const row = this.rows.get(id);
    if (!row) return Promise.resolve(null);
    const { sessionId: _sessionId, ...detail } = row;
    return Promise.resolve(detail);
  }

  listBySession(sessionId: string): Promise<MemorySummary[]> {
    return Promise.resolve(
      this.all.filter((row) => row.sessionId === sessionId).map(summaryOf)
    );
  }

  listActiveLessons(limit: number): Promise<MemorySummary[]> {
    return Promise.resolve(
      this.all
        .filter((row) => row.kind === "lesson" && row.status === "active")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit)
        .map(summaryOf)
    );
  }
}

const summaryOf = (row: StoredMemory): MemorySummary => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  sourceUrl: row.sourceUrl,
});
