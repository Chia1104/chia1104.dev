import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterContractClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import type { routerContract } from "@chia/services/router.contract";
import { SHARED_READS } from "@chia/services/shared/shared-reads";
import { withServiceEndpoint } from "@chia/utils/config";
import { Service } from "@chia/utils/schema";

const endpoint = new URL(
  withServiceEndpoint("/rpc", Service.LegacyService, {
    isInternal: false,
    version: "LEGACY",
  })
);

/**
 * Browser client: public procedures and the visitor's own agent sessions, authenticated by the
 * cross-subdomain session cookie. Never attach `CH_API_KEY`.
 */
export const link = new RPCLink({
  origin: endpoint.origin,
  /** `URL.pathname` always starts with `/`, so this is the pathname unchanged. */
  url: `/${endpoint.pathname.slice(1)}`,
  method: (_options, path) =>
    SHARED_READS.has(path.join(".")) ? "GET" : "POST",
  /** A shared read is answered with `Access-Control-Allow-Origin: *`, which a credentialed request may not read. */
  fetch: (url, init) =>
    globalThis.fetch(url, {
      ...init,
      credentials: init.method === "GET" ? "omit" : "include",
    }),
});

export const client: RouterContractClient<typeof routerContract> =
  createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
