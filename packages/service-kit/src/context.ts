import type { Auth } from "@chia/auth/server";
import type { Session } from "@chia/auth/types";
import type { DB } from "@chia/db/client";
import type { Keyv } from "@chia/kv/types";

/**
 * Per-request context shared by every transport. Keep free of Request/Response and
 * of domain ports.
 *
 * A type alias (not an interface) so `Variables` gets an implicit index signature
 * for Hono's `Env` constraint.
 */
// oxlint-disable-next-line typescript/consistent-type-definitions
export type ServiceContext = {
  headers: Headers;
  clientIP: string;
  db: DB;
  kv: Keyv;
  auth?: Auth;
  /** Pre-resolved session; guards skip `getSession` when set. */
  session?: Session | null;
};

/** Client IP from headers, for callers that hold `Headers` rather than a `Request`. */
export const resolveClientIP = (headers: Headers): string =>
  headers.get("CF-Connecting-IP") ??
  headers.get("X-Forwarded-For")?.split(",")[0] ??
  headers.get("X-Real-IP") ??
  "anonymous";
