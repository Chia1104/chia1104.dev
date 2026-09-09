import "server-only";
import { createAuthClient } from "better-auth/client";

import { X_CF_BYPASS_TOKEN } from "@chia/utils/request";

import { baseAuthClient } from "./base-auth-client";
import { env } from "./env";

/**
 * Forwards the visitor's cookie only. An API key on `get-session` would answer with the key
 * owner's session whatever the cookie says, and the server would then disagree with the
 * browser about who is signed in.
 */
export const authClient = createAuthClient(
  baseAuthClient({
    fetchOptions: {
      headers: {
        [X_CF_BYPASS_TOKEN]: env.CF_BYPASS_TOKEN ?? "",
      },
    },
  })
);
