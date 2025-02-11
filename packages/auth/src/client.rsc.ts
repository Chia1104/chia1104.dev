import { createAuthClient } from "better-auth/client";

import { X_INTERNAL_REQUEST_SECRET } from "@chia/utils";

import { env } from "./env";
import { baseAuthClient } from "./utils";

export const authClient = createAuthClient(
  baseAuthClient({
    fetchOptions: {
      headers: {
        [X_INTERNAL_REQUEST_SECRET]: env.INTERNAL_REQUEST_SECRET ?? "",
      },
    },
  })
);
