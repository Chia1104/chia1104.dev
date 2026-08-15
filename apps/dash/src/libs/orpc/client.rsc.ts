import "server-only";
import { headers } from "next/headers";

import { createRouterClient } from "@orpc/server";
import { all } from "better-all";

import { router } from "@chia/api/orpc/router";
import type { ORPCConfig } from "@chia/api/orpc/utils";
import { createAuth } from "@chia/auth";
import { authClient } from "@chia/auth/client";
import { connectDatabase } from "@chia/db/client";
import { resolveClientIP } from "@chia/service-kit/context";

/**
 * The in-process client is only reached from RSC on a session; API keys and AI provider
 * cookies never travel this path, so only the rate-limit budget is meaningful here.
 */
const config: ORPCConfig = {
  rateLimit: { windowMs: 5 * 60_000, limit: 300 },
};

globalThis.$client = createRouterClient(router, {
  context: async () => {
    const { db, kv } = await all({
      db: () => connectDatabase(),
      kv: () => import("@chia/kv").then((m) => m.kv),
    });
    const requestHeaders = await headers();
    return {
      headers: requestHeaders,
      clientIP: resolveClientIP(requestHeaders),
      config,
      db,
      kv,
      session: await authClient
        .getSession({ fetchOptions: { headers: await headers() } })
        .then((res) => res.data ?? null)
        .catch(() => null),
      auth: createAuth(db, kv),
    };
  },
});
