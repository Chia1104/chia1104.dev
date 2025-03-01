import { createAuthClient } from "better-auth/react";
import "client-only";

import { baseAuthClient } from "./utils";

export const authClient = createAuthClient(baseAuthClient());
