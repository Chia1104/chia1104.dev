import type { TableConfig } from "drizzle-orm";
import { Table } from "drizzle-orm";
import { is } from "drizzle-orm";
import { getTableName } from "drizzle-orm";
import { Cache } from "drizzle-orm/cache/core";
import type { CacheConfig } from "drizzle-orm/cache/core/types";
import type Keyv from "keyv";

import { kv as defaultKv } from "..";

interface Options {
  ttl?: number;
  strategy?: "explicit" | "all";
}

export class DrizzleCache extends Cache {
  private globalTtl: number;
  private _strategy: "explicit" | "all";
  // This object will be used to store which query keys were used
  // for a specific table, so we can later use it for invalidation.
  private usedTablesPerKey: Record<string, string[]> = {};

  constructor(
    private kv: Keyv = defaultKv,
    options?: Options
  ) {
    super();
    this.globalTtl = options?.ttl ?? 1000;
    this._strategy = options?.strategy ?? "explicit";
  }

  // For the strategy, we have two options:
  // - 'explicit': The cache is used only when .$withCache() is added to a query.
  // - 'all': All queries are cached globally.
  // The default behavior is 'explicit'.
  override strategy(): "explicit" | "all" {
    return this._strategy;
  }

  // This function accepts query and parameters that cached into key param,
  // allowing you to retrieve response values for this query from the cache.
  override async get<TResult = unknown>(
    key: string
  ): Promise<TResult | undefined> {
    const res = (await this.kv.get<TResult>(key)) ?? undefined;
    return res;
  }

  // This function accepts several options to define how cached data will be stored:
  // - 'key': A hashed query and parameters.
  // - 'response': An array of values returned by Drizzle from the database.
  // - 'tables': An array of tables involved in the select queries. This information is needed for cache invalidation.
  //
  // For example, if a query uses the "users" and "posts" tables, you can store this information. Later, when the app executes
  // any mutation statements on these tables, you can remove the corresponding key from the cache.
  // If you're okay with eventual consistency for your queries, you can skip this option.
  override async put<TResponse = unknown>(
    key: string,
    response: TResponse,
    tables: string[],
    isTag: boolean,
    config?: CacheConfig
  ): Promise<void> {
    await this.kv.set(
      key,
      response,
      config?.ex ? config.ex * 1000 : this.globalTtl * 1000
    );
    for (const table of tables) {
      const keys = this.usedTablesPerKey[table];
      if (keys === undefined) {
        this.usedTablesPerKey[table] = [key];
      } else {
        keys.push(key);
      }
    }
  }

  // This function is called when insert, update, or delete statements are executed.
  // You can either skip this step or invalidate queries that used the affected tables.
  //
  // The function receives an object with two keys:
  // - 'tags': Used for queries labeled with a specific tag, allowing you to invalidate by that tag.
  // - 'tables': The actual tables affected by the insert, update, or delete statements,
  //   helping you track which tables have changed since the last cache update.
  override async onMutate(params: {
    tags: string | string[];
    tables: string | string[] | Table<TableConfig> | Table<TableConfig>[];
  }): Promise<void> {
    const tagsArray = params.tags
      ? Array.isArray(params.tags)
        ? params.tags
        : [params.tags]
      : [];
    const tablesArray = params.tables
      ? Array.isArray(params.tables)
        ? params.tables
        : [params.tables]
      : [];

    const keysToDelete = new Set<string>();

    for (const table of tablesArray) {
      const tableName = is(table, Table) ? getTableName(table) : table;
      const keys = this.usedTablesPerKey[tableName] ?? [];
      for (const key of keys) keysToDelete.add(key);
    }

    if (keysToDelete.size > 0 || tagsArray.length > 0) {
      for (const tag of tagsArray) {
        await this.kv.delete(tag);
      }

      for (const key of keysToDelete) {
        await this.kv.delete(key);
        for (const table of tablesArray) {
          const tableName = is(table, Table) ? getTableName(table) : table;
          this.usedTablesPerKey[tableName] = [];
        }
      }
    }
  }
}
