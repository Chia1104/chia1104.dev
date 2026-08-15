import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import type { routerContract } from "@chia/api/orpc/contracts";
import { withServiceEndpoint } from "@chia/utils/config";
import { Service } from "@chia/utils/schema";

/**
 * The one oRPC client in the dashboard. Every procedure call is made from the browser
 * with the session cookie; there is no server-side or in-process path.
 */
export const link = new RPCLink({
  url: withServiceEndpoint("/rpc", Service.LegacyService, {
    isInternal: false,
    version: "LEGACY",
  }),
  fetch: (request, init) =>
    globalThis.fetch(request, { ...init, credentials: "include" }),
});

export const client: ContractRouterClient<typeof routerContract> =
  createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
