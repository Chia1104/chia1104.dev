import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@chia/auth-core";

export const { GET, POST } = toNextJsHandler(auth.handler);
