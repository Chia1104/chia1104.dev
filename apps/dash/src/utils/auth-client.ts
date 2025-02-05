import { createAuthClient } from "better-auth/react";

import { getServiceEndPoint } from "@chia/utils";

export const authClient = createAuthClient({
  baseURL: getServiceEndPoint(),
});
