import { inferAdditionalFields } from "better-auth/client/plugins";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { Role } from "@chia/db/types";
import { getServiceEndPoint, X_INTERNAL_REQUEST_SECRET } from "@chia/utils";

import { env } from "./env";

export const authClient = createAuthClient({
  baseURL: `${getServiceEndPoint()}/auth`,
  plugins: [
    inferAdditionalFields({
      user: {
        role: {
          type: [Role.User, Role.Admin],
          required: true,
          defaultValue: Role.User,
          input: true,
        },
      },
    }),
    magicLinkClient(),
  ],
  fetchOptions: {
    headers: {
      [X_INTERNAL_REQUEST_SECRET]: env.INTERNAL_REQUEST_SECRET ?? "",
    },
  },
});
