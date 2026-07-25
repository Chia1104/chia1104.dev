import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import type { routerContract } from "@chia/api/orpc/contracts";
import { withServiceEndpoint } from "@chia/utils/config";
import { Service } from "@chia/utils/schema";

/**
 * Browser-side client — talks to the service directly.
 *
 * It may only call the service's **public** procedures. The project API key authenticates
 * one deployment to another (www on Vercel → service on Railway) and must never reach a
 * browser, so anything the browser needs is exposed as a public procedure instead.
 *
 * Server-side callers use `client.rsc.ts`, which does carry the key.
 */
export const link = new RPCLink({
  url: withServiceEndpoint("/rpc", Service.LegacyService, {
    isInternal: false,
    version: "LEGACY",
  }),
});

export const client: ContractRouterClient<typeof routerContract> =
  createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
