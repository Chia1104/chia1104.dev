"use client";

import { httpBatchLink, loggerLink } from "@trpc/client";
import { experimental_createTRPCNextAppDirClient as createTRPCNextAppDirClient } from "@trpc/next/app-dir/client";
import { type AppRouter } from "api";
import { getBaseUrl } from "@/utils/getBaseUrl";
import { IS_PRODUCTION } from "@/shared/constants";
import transformer from "superjson";

export const api = createTRPCNextAppDirClient<AppRouter>({
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
          url: getBaseUrl() + "/api/trpc",
          headers() {
            return {
              "x-trpc-source": "client",
            };
          },
        }),
      ],
    };
  },
});
