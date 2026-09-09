import "server-only";
import { headers } from "next/headers";
import { cache } from "react";

import { authClient } from "@chia/auth/client";

/** One answer per request; layouts decide what to render from `session.access`. */
export const getSession = cache(async () => {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
    },
  });
  return session;
});
