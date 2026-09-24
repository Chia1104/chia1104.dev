import "server-only";
import { headers } from "next/headers";

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterContractClient } from "@orpc/contract";

import type { routerContract } from "@chia/services/router.contract";
import { withServiceEndpoint } from "@chia/utils/config";
import { Service } from "@chia/utils/schema";

const endpoint = new URL(
  withServiceEndpoint("/rpc", Service.LegacyService, {
    isInternal: false,
    version: "LEGACY",
  })
);

/**
 * Server-only twin of `client.ts` that forwards the visitor's cookie. It carries no key of
 * its own: it is the same person the browser client is.
 */
export const link = new RPCLink({
  origin: endpoint.origin,
  /** `URL.pathname` always starts with `/`, so this is the pathname unchanged. */
  url: `/${endpoint.pathname.slice(1)}`,
  headers: async () => ({ cookie: (await headers()).get("cookie") ?? "" }),
});

export const client: RouterContractClient<typeof routerContract> =
  createORPCClient(link);
