export const ADMIN_ID = "admin-user";

/** Structural session fixture. Consumers assign it to their `Session` type. */
export interface TestSession {
  session: { id: string; userId: string };
  user: { id: string; role: string; isAnonymous?: boolean };
  access: {
    tier: 0 | 1 | 2 | 3 | 4;
    dashboard: "operator" | "member" | null;
    agent: Record<string, 0 | 1 | 2 | 3 | 4>;
  };
}

export const sessionOf = (id: string, role: string): TestSession => ({
  session: { id: "s1", userId: id },
  user: { id, role },
  access:
    id === ADMIN_ID
      ? { tier: 4, dashboard: "operator", agent: {} }
      : { tier: 3, dashboard: "member", agent: {} },
});
