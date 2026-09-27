import "server-only";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterContractClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import type { routerContract } from "@chia/services/router.contract";
import { WwwCacheTag, withServiceEndpoint } from "@chia/utils/config";
import { X_CF_BYPASS_TOKEN } from "@chia/utils/request";
import { Service } from "@chia/utils/schema";

import { env } from "@/env";

const endpoint = new URL(
  withServiceEndpoint("/rpc", Service.LegacyService, {
    isInternal: false,
    version: "LEGACY",
  })
);

/** Per call: cache tags for the page making it, beyond the ones its procedure implies. */
export interface RSCClientContext {
  cacheTags?: readonly string[];
}

/** An article's own tag depends on its slug, so the article call adds it. */
const PROCEDURE_CACHE_TAGS = new Map([
  ["feeds.list", [WwwCacheTag.Listings]],
  ["tags.list", [WwwCacheTag.Listings]],
  ["feeds.details-by-slug", [WwwCacheTag.Articles]],
]);

export const link = new RPCLink<RSCClientContext>({
  origin: endpoint.origin,
  /** `URL.pathname` always starts with `/`, so this is the pathname unchanged. */
  url: `/${endpoint.pathname.slice(1)}`,
  headers: {
    /** Server-only: Cloudflare bypass plus `CH_API_KEY`. Browser `client.ts` must never get the key. */
    [X_CF_BYPASS_TOKEN]: env.CF_BYPASS_TOKEN ?? "",
    "x-ch-api-key": env.CH_API_KEY ?? "",
  },
  /** The tags land on the prerendered page, not on this uncached POST. */
  fetch: (url, init, options, path) =>
    fetch(url, {
      ...init,
      next: {
        tags: [
          ...(PROCEDURE_CACHE_TAGS.get(path.join(".")) ?? []),
          ...(options.context.cacheTags ?? []),
        ],
      },
    }),
});

export const client: RouterContractClient<
  typeof routerContract,
  RSCClientContext
> = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
