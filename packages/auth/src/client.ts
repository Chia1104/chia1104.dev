import "client-only";

import { createAuthClient } from "better-auth/react";

import { baseAuthClient } from "./utils";

export const authClient = createAuthClient(baseAuthClient());
