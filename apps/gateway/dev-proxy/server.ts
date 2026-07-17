import { Hono } from "hono";
import { logger } from "hono/logger";

import {
  sanitizeHeaders,
  TRUSTED_HEADERS,
  X_CH_INTERNAL_TOKEN,
} from "@chia/utils/gateway";

import type { DevProxyRoute } from "../routes.config";
import { routes } from "../routes.config";

/**
 * Local stand-in for the production Caddy gateway (`../caddy/Caddyfile`):
 * strips spoofable identity headers, blocks internal routes, authenticates
 * gated prefixes against the auth service's `/auth/internal/gate` and proxies
 * to the local upstreams. Responses are returned as-is, so streaming (AI
 * generate) passes through untouched.
 *
 * The gate requires `INTERNAL_AUTH_SERVICE_TOKEN` to be set both here and on
 * the auth service; without it, gated routes are proxied anonymously.
 */

const PORT = Number(process.env.PORT ?? 8787);

const X_CH_API_KEY = "x-ch-api-key";

const upstreamFor = (route: DevProxyRoute) =>
  process.env[`DEV_${route.target}_UPSTREAM`] ??
  `http://localhost:${route.port}`;

const authUpstream = () =>
  process.env.DEV_AUTH_UPSTREAM ?? "http://localhost:3006";

const matchRoute = (pathname: string) =>
  routes.find(
    (route) =>
      pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)
  );

/**
 * Mirror of Caddy's `forward_auth`: authenticates the request at the edge and
 * returns the trusted identity headers to inject upstream, or the gate's
 * error response to relay verbatim.
 */
const forwardAuth = async (
  request: Request,
  mode: "optional" | "required"
): Promise<Headers | Response> => {
  const gateHeaders = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) {
    gateHeaders.set("cookie", cookie);
  }
  const apiKey = request.headers.get(X_CH_API_KEY);
  if (apiKey) {
    gateHeaders.set(X_CH_API_KEY, apiKey);
  }
  if (process.env.INTERNAL_AUTH_SERVICE_TOKEN) {
    gateHeaders.set(
      X_CH_INTERNAL_TOKEN,
      process.env.INTERNAL_AUTH_SERVICE_TOKEN
    );
  }

  const gateResponse = await fetch(
    `${authUpstream()}/auth/internal/gate?mode=${mode}`,
    { headers: gateHeaders }
  );

  if (gateResponse.status !== 204) {
    return gateResponse;
  }

  const identity = new Headers();
  for (const header of TRUSTED_HEADERS) {
    const value = gateResponse.headers.get(header);
    if (value) {
      identity.set(header, value);
    }
  }
  return identity;
};

const app = new Hono();

app.use(logger());

app.all("*", async (c) => {
  const url = new URL(c.req.url);
  const route = matchRoute(url.pathname);

  if (!route || route.block) {
    return c.json({ message: "Not Found" }, 404);
  }

  // Spoof-parity with Caddy: identity headers are only ever injected by the
  // gate, never accepted from the client.
  const headers = sanitizeHeaders(c.req.raw.headers);
  for (const header of TRUSTED_HEADERS) {
    headers.delete(header);
  }

  if (route.gate) {
    const gateResult = await forwardAuth(c.req.raw, route.gate);
    if (gateResult instanceof Response) {
      return gateResult;
    }
    for (const [header, value] of gateResult) {
      headers.set(header, value);
    }
  }

  const pathname = route.rewrite
    ? `${route.rewrite[1]}${url.pathname.slice(route.rewrite[0].length)}`
    : url.pathname;
  const target = new URL(`${pathname}${url.search}`, upstreamFor(route));

  const hasBody =
    c.req.method !== "GET" &&
    c.req.method !== "HEAD" &&
    c.req.raw.body !== null;

  return await fetch(target, {
    method: c.req.method,
    headers,
    redirect: "manual",
    ...(hasBody
      ? ({ body: c.req.raw.body, duplex: "half" } as RequestInit)
      : {}),
  });
});

console.log(`[dev-proxy] listening on http://localhost:${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
