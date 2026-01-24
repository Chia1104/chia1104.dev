import "server-only";

import { headers } from "next/headers";

import { createRouterClient } from "@orpc/server";
import { all } from "better-all";

import { router } from "@chia/api/orpc/router";
import { createAuth } from "@chia/auth";
import { authClient } from "@chia/auth/client";
import { connectDatabase } from "@chia/db/client";

globalThis.$client = createRouterClient(router, {
  context: async () => {
    const { db, kv } = await all({
      db: () => connectDatabase(),
      kv: () => import("@chia/kv").then((m) => m.kv),
    });
    return {
      headers: await headers(),
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
