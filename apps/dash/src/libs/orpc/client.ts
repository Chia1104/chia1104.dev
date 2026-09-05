import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RetryLinkPlugin } from "@orpc/client/plugins";
import type { RetryLinkPluginContext } from "@orpc/client/plugins";
import type { RouterContractClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import type { routerContract } from "@chia/api/orpc/contracts";
import { withServiceEndpoint } from "@chia/utils/config";
import { Service } from "@chia/utils/schema";

const endpoint = new URL(
  withServiceEndpoint("/rpc", Service.LegacyService, {
    isInternal: false,
    version: "LEGACY",
  })
);

/** Per-call options: only a call that asks for `retry` is retried, so mutations never repeat. */
export type DashClientContext = RetryLinkPluginContext;

/** The dashboard's only oRPC client. Every call is from the browser with the session cookie; there is no server-side or in-process path. */
export const link = new RPCLink<DashClientContext>({
  origin: endpoint.origin,
  /** SAFETY: `URL.pathname` always starts with `/`. */
  url: endpoint.pathname as `/${string}`,
  fetch: (url, init) =>
    globalThis.fetch(url, { ...init, credentials: "include" }),
  plugins: [new RetryLinkPlugin()],
});

export const client: RouterContractClient<
  typeof routerContract,
  DashClientContext
> = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
