import "server-only";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterContractClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import type { routerContract } from "@chia/api/orpc/contracts";
import { withServiceEndpoint } from "@chia/utils/config";
import { X_CF_BYPASS_TOKEN } from "@chia/utils/request";
import { Service } from "@chia/utils/schema";

import { env } from "@/env";

const endpoint = new URL(
  withServiceEndpoint("/rpc", Service.LegacyService, {
    isInternal: false,
    version: "LEGACY",
  })
);

export const link = new RPCLink({
  origin: endpoint.origin,
  /** SAFETY: `URL.pathname` always starts with `/`. */
  url: endpoint.pathname as `/${string}`,
  headers: {
    /** Server-only: Cloudflare bypass plus `CH_API_KEY`. Browser `client.ts` must never get the key. */
    [X_CF_BYPASS_TOKEN]: env.CF_BYPASS_TOKEN ?? "",
    "x-ch-api-key": env.CH_API_KEY ?? "",
  },
});

export const client: RouterContractClient<typeof routerContract> =
  createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
