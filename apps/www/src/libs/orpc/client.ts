import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import type { routerContract } from "@chia/api/orpc/contracts";
import { withServiceEndpoint } from "@chia/utils/config";
import { Service } from "@chia/utils/schema";

/**
 * Per-call client context. `headers` exists so a caller can attach request headers a
 * procedure's guards read — e.g. the captcha token for `email.send`, which travels in a
 * header so the policy never has to consume the request body.
 */
export interface ClientContext {
  headers?: Record<string, string>;
}

export const link = new RPCLink<ClientContext>({
  url: withServiceEndpoint("/rpc", Service.LegacyService, {
    isInternal: false,
    version: "LEGACY",
  }),
  headers: ({ context }) => context?.headers ?? {},
});

export const client: ContractRouterClient<
  typeof routerContract,
  ClientContext
> = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
