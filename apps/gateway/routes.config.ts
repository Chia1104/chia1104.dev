/**
 * Single source of truth for the gateway routing table, consumed by the local
 * dev proxy (`dev-proxy/server.ts`). `caddy/Caddyfile` is the production
 * equivalent — keep both in sync when adding or removing routes.
 *
 * Order matters: the first matching prefix wins, so keep entries sorted from
 * most specific to most generic.
 */

export type DevProxyTarget = "AUTH" | "AI" | "SERVICE";

export interface DevProxyRoute {
  /** Path prefix to match (first match wins). */
  prefix: string;
  /** Respond 404 — server-to-server routes must never be publicly reachable. */
  block?: boolean;
  /** Upstream key; overridable at runtime with `DEV_<TARGET>_UPSTREAM`. */
  target?: DevProxyTarget;
  /** Default local port of the upstream when no env override is set. */
  port?: number;
  /**
   * Authenticate at the edge via the auth service's `/auth/internal/gate`
   * before proxying, mirroring Caddy's `forward_auth`. `optional` lets
   * anonymous requests through without identity headers.
   */
  gate?: "optional" | "required";
  /** `[from, to]` path prefix rewrite applied before proxying. */
  rewrite?: [string, string];
}

export const routes: readonly DevProxyRoute[] = [
  { prefix: "/auth/internal", block: true },
  { prefix: "/ai/internal", block: true },
  { prefix: "/workflow", block: true },
  { prefix: "/auth", target: "AUTH", port: 3006 },
  {
    prefix: "/api/v1/auth",
    target: "AUTH",
    port: 3006,
    rewrite: ["/api/v1/auth", "/auth"],
  },
  { prefix: "/ai", target: "AI", port: 3007, gate: "optional" },
  {
    prefix: "/api/v1/ai",
    target: "AI",
    port: 3007,
    gate: "optional",
    rewrite: ["/api/v1/ai", "/ai"],
  },
  { prefix: "/api/v1", target: "SERVICE", port: 3005, gate: "optional" },
];
