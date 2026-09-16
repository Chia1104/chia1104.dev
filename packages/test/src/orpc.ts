import { test as base } from "vitest";

import { ADMIN_ID, sessionOf } from "./session";

/** oRPC route tests run as the configured admin unless the case overrides the session. */
export const it = base.extend("session", () => sessionOf(ADMIN_ID, "admin"));
