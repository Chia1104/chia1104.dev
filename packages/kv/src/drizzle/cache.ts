import { getTableName } from "drizzle-orm";
import type { Table } from "drizzle-orm";
import { Cache } from "drizzle-orm/cache/core";
import type { MutationOption } from "drizzle-orm/cache/core";
import type { CacheConfig } from "drizzle-orm/cache/core/types";
import type Keyv from "keyv";

interface Options {
  ttlMs?: number;
  strategy?: "explicit" | "all";
}

interface CacheIndexEntry {
  key: string;
  expiresAt: number;
}

interface CacheEntryMetadata {
  tables: string[];
  expiresAt: number;
}

const TABLE_INDEX_PREFIX = "drizzle:cache:table:";
const ENTRY_METADATA_PREFIX = "drizzle:cache:entry:";

export class DrizzleCache extends Cache {
  private globalTtlMs: number;
  private _strategy: "explicit" | "all";
  private kv: Keyv;

  constructor(kv: Keyv, options?: Options) {
    super();
    this.kv = kv;
    this.globalTtlMs = options?.ttlMs ?? 60_000;
    this._strategy = options?.strategy ?? "explicit";
  }

  override strategy(): "explicit" | "all" {
    return this._strategy;
  }

  override async get<TResult = unknown>(
    key: string
  ): Promise<TResult | undefined> {
    return (await this.kv.get<TResult>(key)) ?? undefined;
  }

  override async put<TResponse = unknown>(
    key: string,
    response: TResponse,
    tables: string[],
    _isTag: boolean,
    config?: CacheConfig
  ): Promise<void> {
    const ttlMs = this.resolveTtlMs(config);
    const expiresAt = Date.now() + ttlMs;
    const tableNames = [...new Set(tables)];

    await this.kv.set(key, response, ttlMs);
    await this.kv.set(
      this.entryMetadataKey(key),
      {
        tables: tableNames,
        expiresAt,
      } satisfies CacheEntryMetadata,
      ttlMs
    );

    await Promise.all(
      tableNames.map((table) => this.addTableIndexEntry(table, key, expiresAt))
    );
  }

  override async onMutate(params: MutationOption): Promise<void> {
    const tags = params.tags
      ? Array.isArray(params.tags)
        ? params.tags
        : [params.tags]
      : [];
    const tableNames = (
      params.tables
        ? Array.isArray(params.tables)
          ? params.tables
          : [params.tables]
        : []
    ).map((table) => this.resolveTableName(table));
    const now = Date.now();
    const keysToDelete = new Set(tags);

    const indexes = await Promise.all(
      tableNames.map(async (table) => ({
        table,
        entries: await this.getTableIndex(table),
      }))
    );
    for (const { entries } of indexes) {
      for (const entry of entries) {
        if (entry.expiresAt > now) {
          keysToDelete.add(entry.key);
        }
      }
    }

    const metadata = await Promise.all(
      [...keysToDelete].map(async (key) => ({
        key,
        metadata: await this.kv.get<CacheEntryMetadata>(
          this.entryMetadataKey(key)
        ),
      }))
    );
    const affectedTables = new Set(tableNames);
    for (const entry of metadata) {
      for (const table of entry.metadata?.tables ?? []) {
        affectedTables.add(table);
      }
    }

    await Promise.all(
      [...keysToDelete].flatMap((key) => [
        this.kv.delete(key),
        this.kv.delete(this.entryMetadataKey(key)),
      ])
    );
    await Promise.all(
      [...affectedTables].map((table) =>
        this.removeTableIndexEntries(table, keysToDelete, now)
      )
    );
  }

  private resolveTtlMs(config?: CacheConfig): number {
    if (config?.px !== undefined) {
      return config.px;
    }
    if (config?.ex !== undefined) {
      return config.ex * 1000;
    }
    if (config?.pxat !== undefined) {
      return Math.max(1, config.pxat - Date.now());
    }
    if (config?.exat !== undefined) {
      return Math.max(1, config.exat * 1000 - Date.now());
    }
    return this.globalTtlMs;
  }

  private tableIndexKey(table: string): string {
    return `${TABLE_INDEX_PREFIX}${table}`;
  }

  private resolveTableName(table: string | Table): string {
    return typeof table === "string" ? table : getTableName(table);
  }

  private entryMetadataKey(key: string): string {
    return `${ENTRY_METADATA_PREFIX}${key}`;
  }

  private async getTableIndex(table: string): Promise<CacheIndexEntry[]> {
    return (
      (await this.kv.get<CacheIndexEntry[]>(this.tableIndexKey(table))) ?? []
    );
  }

  private async addTableIndexEntry(
    table: string,
    key: string,
    expiresAt: number
  ): Promise<void> {
    const now = Date.now();
    const entries = (await this.getTableIndex(table)).filter(
      (entry) => entry.expiresAt > now && entry.key !== key
    );
    entries.push({ key, expiresAt });
    await this.kv.set(this.tableIndexKey(table), entries);
  }

  private async removeTableIndexEntries(
    table: string,
    keys: ReadonlySet<string>,
    now: number
  ): Promise<void> {
    const indexKey = this.tableIndexKey(table);
    const entries = (await this.getTableIndex(table)).filter(
      (entry) => entry.expiresAt > now && !keys.has(entry.key)
    );

    if (entries.length === 0) {
      await this.kv.delete(indexKey);
      return;
    }
    await this.kv.set(indexKey, entries);
  }
}
