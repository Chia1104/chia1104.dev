import { test as base } from "vitest";

import { ADMIN_ID, sessionOf } from "./session";

export { ADMIN_ID, sessionOf } from "./session";
export type { TestSession } from "./session";
export { contextOf } from "./context";
export { describe, expect } from "vitest";

export const it = base.extend("session", () => sessionOf(ADMIN_ID, "admin"));
