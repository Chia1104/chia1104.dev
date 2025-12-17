import { createRouterClient } from "@orpc/server";
import { headers } from "next/headers";
import "server-only";

import { router } from "@chia/api/orpc/router";
import { authClient } from "@chia/auth/client";
import { connectDatabase } from "@chia/db/client";
import { kv } from "@chia/kv";

globalThis.$client = createRouterClient(router, {
  context: async () => ({
    headers: await headers(),
    db: await connectDatabase(),
    redis: kv,
    session: await authClient
      .getSession({
        fetchOptions: {
          headers: await headers(),
        },
      })
      .then((res) => res.data ?? null)
      .catch(() => null),
  }),
});
