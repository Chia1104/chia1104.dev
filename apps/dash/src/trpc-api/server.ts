"use server";

import { httpBatchLink, loggerLink } from "@trpc/client";
import { experimental_createTRPCNextAppDirServer as createTRPCNextAppDirServer } from "@trpc/next/app-dir/server";
import { type AppRouter } from "@chia/api";
import { getBaseUrl } from "@/utils/getBaseUrl";
import { IS_PRODUCTION } from "@/shared/constants";
import { headers } from "next/headers";
import transformer from "superjson";

export const api = createTRPCNextAppDirServer<AppRouter>({
  config() {
    return {
      transformer,
      links: [
        loggerLink({
          enabled: (opts) =>
            !IS_PRODUCTION ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
        httpBatchLink({
          url: getBaseUrl({ isServer: true }) + "/api/trpc",
          headers() {
            const heads = new Map(headers());
            heads.set("x-trpc-source", "rsc");
            return Object.fromEntries(heads);
          },
        }),
      ],
    };
  },
});
