import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import type { router } from "@chia/api/orpc/router";
import { withServiceEndpoint } from "@chia/utils/config";
import { Service } from "@chia/utils/schema";

declare global {
  var $client: RouterClient<typeof router> | undefined;
}

export const link = new RPCLink({
  url: withServiceEndpoint("/rpc", Service.LegacyService, {
    isInternal: false,
    version: "LEGACY",
  }),
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
