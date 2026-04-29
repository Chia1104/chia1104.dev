import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import type { routerContract } from "@chia/api/orpc/contracts";
import { withServiceEndpoint } from "@chia/utils/config";
import { X_CF_BYPASS_TOKEN } from "@chia/utils/request";
import { Service } from "@chia/utils/schema";

import { env } from "@/env";

export const link = new RPCLink({
  url: withServiceEndpoint("/rpc", Service.LegacyService, {
    isInternal: false,
    version: "LEGACY",
  }),
  headers: {
    [X_CF_BYPASS_TOKEN]: env.CF_BYPASS_TOKEN ?? "",
  },
});

export const client: ContractRouterClient<typeof routerContract> =
  createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
