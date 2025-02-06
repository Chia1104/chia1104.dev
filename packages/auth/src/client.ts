import { inferAdditionalFields } from "better-auth/client/plugins";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { Role } from "@chia/db/types";
import { getServiceEndPoint } from "@chia/utils";

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
});
