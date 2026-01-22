/**
 * @TODO: WIP
 */
import { createAuthClient } from "better-auth/client";

import { baseAuthClient } from "@chia/auth/utils";
import { withServiceEndpoint } from "@chia/utils/config";
import { Service } from "@chia/utils/schema";

export const AUTH_SERVICE_ENDPOINT = withServiceEndpoint("", Service.Auth, {
  isInternal: true,
  version: "auth",
});

export const authClient = createAuthClient(
  baseAuthClient({
    baseURL: AUTH_SERVICE_ENDPOINT,
  })
);
