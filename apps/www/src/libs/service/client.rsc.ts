import { hc } from "hono/client";
import "server-only";
import type { AppRPC } from "service/server";

import { withServiceEndpoint } from "@chia/utils/config";
import { X_CF_BYPASS_TOKEN } from "@chia/utils/request";
import { Service } from "@chia/utils/schema";

import { env } from "@/env";

export const client = hc<AppRPC>(
  withServiceEndpoint("/", Service.LegacyService, {
    isInternal: true,
    version: "NO_PREFIX",
  }),
  {
    headers: {
      [X_CF_BYPASS_TOKEN]: env.CF_BYPASS_TOKEN ?? "",
      "x-ch-api-key": env.CH_API_KEY ?? "",
    },
  }
);
