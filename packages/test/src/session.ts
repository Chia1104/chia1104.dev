import type { Session } from "@chia/auth/types";

export const ADMIN_ID = "admin-user";

export const sessionOf = (id: string, role: string): Session =>
  /* SAFETY: This fixture implements the Session members exercised by route and policy tests. */ ({
    session: { id: "s1", userId: id },
    user: { id, role },
  }) as Session;
