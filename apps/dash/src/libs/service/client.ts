import "client-only";
import { hc } from "hono/client";
import type { AppRPC } from "~service/server";

import { withServiceEndpoint } from "@chia/utils/config";
import { Service } from "@chia/utils/schema";

export const client = hc<AppRPC>(
  withServiceEndpoint("/", Service.LegacyService, {
    isInternal: false,
    version: "NO_PREFIX",
  })
);
