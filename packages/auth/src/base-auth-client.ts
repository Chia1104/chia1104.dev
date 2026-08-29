import { apiKeyClient } from "@better-auth/api-key/client";
import { passkeyClient } from "@better-auth/passkey/client";
import type { BetterAuthClientOptions } from "better-auth";
import { anonymousClient } from "better-auth/client/plugins";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { magicLinkClient } from "better-auth/client/plugins";
import { organizationClient } from "better-auth/client/plugins";
import { adminClient } from "better-auth/client/plugins";

import { Role } from "@chia/db/types";
import { withServiceEndpoint } from "@chia/utils/config";
import { Service } from "@chia/utils/schema";

export const baseAuthClient = (config?: Partial<BetterAuthClientOptions>) => {
  return {
    ...config,
    baseURL:
      config?.baseURL ??
      withServiceEndpoint("/auth", Service.LegacyService, {
        isInternal: false,
        version: "LEGACY",
      }),
    plugins: [
      inferAdditionalFields({
        user: {
          role: {
            type: [Role.User, Role.Admin, Role.Root],
            required: true,
            defaultValue: Role.User,
            input: true,
          },
        },
      }),
      magicLinkClient(),
      passkeyClient(),
      apiKeyClient(),
      organizationClient(),
      adminClient(),
      anonymousClient(),
    ],
  } satisfies BetterAuthClientOptions;
};
