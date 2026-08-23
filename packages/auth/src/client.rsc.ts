import "server-only";
import { createAuthClient } from "better-auth/client";

import { X_CF_BYPASS_TOKEN } from "@chia/utils/request";

import { baseAuthClient } from "./base-auth-client";
import { env } from "./env";
import { X_CH_API_KEY } from "./utils";

export const authClient = createAuthClient(
  baseAuthClient({
    fetchOptions: {
      headers: {
        [X_CF_BYPASS_TOKEN]: env.CF_BYPASS_TOKEN ?? "",
        [X_CH_API_KEY]: env.CH_API_KEY ?? "",
      },
    },
  })
);
