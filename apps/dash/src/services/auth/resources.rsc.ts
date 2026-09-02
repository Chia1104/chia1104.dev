import "server-only";
import { headers } from "next/headers";
import { cache } from "react";

import { safe } from "@orpc/client";

import { authClient } from "@chia/auth/client";

import { client } from "@/libs/orpc/client.rsc";

export const getSession = cache(async () => {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
    },
  });
  return session;
});

/** One answer per request; layouts decide what to render from it. */
export const getAccess = cache(() => safe(client.dashboard.access()));
