export const ADMIN_ID = "admin-user";

/** Structural session fixture. Consumers assign it to their `Session` type. */
export interface TestSession {
  session: { id: string; expiresAt: Date };
  user: {
    id: string;
    name: string;
    email: string | null;
    image: string | null;
    isAnonymous: boolean;
  };
}

export const sessionOf = (
  id: string,
  options: { isAnonymous?: boolean } = {}
): TestSession => ({
  session: { id: "s1", expiresAt: new Date("2099-01-01T00:00:00.000Z") },
  user: {
    id,
    name: id,
    email: options.isAnonymous ? null : `${id}@example.com`,
    image: null,
    isAnonymous: options.isAnonymous ?? false,
  },
});
