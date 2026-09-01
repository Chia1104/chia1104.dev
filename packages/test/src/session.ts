export const ADMIN_ID = "admin-user";

/** Structural session fixture. Consumers assign it to their `Session` type. */
export interface TestSession {
  session: { id: string; userId: string };
  user: { id: string; role: string; isAnonymous?: boolean };
}

export const sessionOf = (id: string, role: string): TestSession => ({
  session: { id: "s1", userId: id },
  user: { id, role },
});
