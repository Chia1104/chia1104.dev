"use server";

import {
  createTRPCProxyClient,
  loggerLink,
  unstable_httpBatchStreamLink,
} from "@trpc/client";
import { type AppRouter } from "@chia/api";
import { getBaseUrl } from "@/utils/getBaseUrl";
import { IS_PRODUCTION } from "@/shared/constants";
import { headers } from "next/headers";
import transformer from "superjson";

export const api = createTRPCProxyClient<AppRouter>({
  transformer,
  links: [
    loggerLink({
      enabled: (opts) =>
        !IS_PRODUCTION ||
        (opts.direction === "down" && opts.result instanceof Error),
    }),
    unstable_httpBatchStreamLink({
      url: getBaseUrl({ isServer: true }) + "/api/trpc",
      headers() {
        const heads = new Map(headers());
        heads.set("x-trpc-source", "rsc");
        return Object.fromEntries(heads);
      },
    }),
  ],
});
