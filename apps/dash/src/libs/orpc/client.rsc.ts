import { createRouterClient } from "@orpc/server";
import { headers } from "next/headers";
import "server-only";

import { router } from "@chia/api/orpc/router";
import { authClient } from "@chia/auth/client";
import { connectDatabase } from "@chia/db/client";

globalThis.$client = createRouterClient(router, {
  context: async () => ({
    headers: await headers(),
    db: await connectDatabase(),
    kv: await import("@chia/kv").then((m) => m.kv),
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
