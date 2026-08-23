import "client-only";
import { createAuthClient } from "better-auth/react";

import { baseAuthClient } from "./base-auth-client";

export const authClient = createAuthClient(baseAuthClient());
