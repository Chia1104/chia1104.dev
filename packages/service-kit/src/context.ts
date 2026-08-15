import type { Auth } from "@chia/auth";
import type { Session } from "@chia/auth/types";
import type { DB } from "@chia/db";
import type { Keyv } from "@chia/kv";

/**
 * The single per-request context shared by every transport.
 *
 * Hono exposes it as `c.var` (see the `Variables` global in each service app) and
 * oRPC extends it as its handler context, so mounting the RPC handler is a spread
 * of `c.var` rather than a hand-written field-by-field mapping.
 *
 * Keep this free of transport concerns (no `Request`, no `Response`) and free of
 * domain ports — those are registered per app, not carried per request.
 *
 * Declared as a type alias rather than an interface on purpose: Hono's `Env`
 * constraint requires `Variables` to satisfy `Record<string, unknown>`, and only type
 * aliases get an implicit index signature.
 */
// oxlint-disable-next-line typescript/consistent-type-definitions
export type ServiceContext = {
  headers: Headers;
  clientIP: string;
  db: DB;
  kv: Keyv;
  auth?: Auth;
  /**
   * Pre-resolved session. A caller that already holds one (an in-process router
   * client, a test context) sets it so guards skip the `getSession` round trip.
   */
  session?: Session | null;
};

/**
 * Header-based counterpart to `getClientIP` from `@chia/utils/server`, for callers
 * that hold a `Headers` rather than a whole `Request` (oRPC contexts, RSC).
 */
export const resolveClientIP = (headers: Headers): string =>
  headers.get("CF-Connecting-IP") ??
  headers.get("X-Forwarded-For")?.split(",")[0] ??
  headers.get("X-Real-IP") ??
  "anonymous";
