import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { DrizzleCache } from "@chia/kv/drizzle/cache";
import { getRedisKv } from "@chia/kv/redis";

vi.mock("../src/env.ts", () => ({ env: {} }));
vi.mock("@chia/kv/redis", async () => {
  const { default: Keyv } = await import("keyv");
  const store = new Keyv();
  return { getRedisKv: () => store };
});

import { invalidateCache } from "../src/client.ts";
import { feedTranslations } from "../src/schemas/schema.ts";

/**
 * A workflow step writes on a connection without a cache; the entries it must drop were put
 * there by the service's connection. One Keyv stands in for the Redis both share.
 */
describe("invalidateCache", () => {
  it("drops another connection's entries for the table", async () => {
    const reader = new DrizzleCache(getRedisKv());
    await reader.put(
      "q:feed",
      { rows: [] },
      [getTableName(feedTranslations)],
      false
    );
    await reader.put("q:tag", { rows: [] }, ["tag"], false);

    await invalidateCache([feedTranslations]);

    expect(await reader.get("q:feed")).toBeUndefined();
    expect(await reader.get("q:tag")).toEqual({ rows: [] });
  });
});
