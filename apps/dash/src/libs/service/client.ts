import "client-only";
import { hc } from "hono/client";
import type { AIAppRPC } from "~ai-service/server";
import type { AppRPC } from "~service/server";

import { withServiceEndpoint } from "@chia/utils/config";
import { Service } from "@chia/utils/schema";

export const client = hc<AppRPC>(
  withServiceEndpoint("/", Service.LegacyService, {
    isInternal: false,
    version: "NO_PREFIX",
  }),
  {
    init: {
      credentials: "include",
    },
  }
);

export const aiClient = hc<AIAppRPC>(
  withServiceEndpoint("/", Service.AI, {
    isInternal: false,
    version: "NO_PREFIX",
  }),
  {
    init: {
      credentials: "include",
    },
  }
);
