import { test as base } from "vitest";

import { contextOf } from "./context";
import { ADMIN_ID, sessionOf } from "./session";

export { ADMIN_ID, sessionOf } from "./session";
export { contextOf } from "./context";
export { describe, expect } from "vitest";

export const it = base
  .extend("session", () => sessionOf(ADMIN_ID, "admin"))
  .extend("context", ({ session }) => contextOf(session));
