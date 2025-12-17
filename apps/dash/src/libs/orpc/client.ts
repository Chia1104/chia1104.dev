import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import type { router } from "@chia/api/orpc/router";
import { getServiceEndPoint } from "@chia/utils";

declare global {
  var $client: RouterClient<typeof router> | undefined;
}

export const link = new RPCLink({
  url: `${getServiceEndPoint()}/rpc`,
  fetch: (request, init) => {
    return globalThis.fetch(request, {
      ...init,
      credentials: "include",
    });
  },
  headers: async () => {
    if (typeof window !== "undefined") {
      return {};
    }

    const { headers } = await import("next/headers");
    return await headers();
  },
});

export const client: RouterClient<typeof router> =
  globalThis.$client ?? createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
