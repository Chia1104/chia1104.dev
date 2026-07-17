import { APIError } from "better-auth/api";

import { sanitizeHeaders, X_CH_INTERNAL_TOKEN } from "@chia/utils/gateway";

import type { Auth } from "./";

export const name = "auth-gateway";

// Generic gateway plumbing lives in @chia/utils/gateway — re-exported here
// for backward compatibility.
export {
  X_CH_INTERNAL_TOKEN,
  X_CH_AUTH_SESSION,
  X_CH_AUTH_API_KEY,
  TRUSTED_HEADERS,
  encodeTrustedHeader,
  decodeTrustedHeader,
  sanitizeHeaders,
  HOP_BY_HOP_HEADERS,
  isValidInternalToken,
} from "@chia/utils/gateway";

/**
 * The subset of the better-auth server API that consumers (guards, orpc routes)
 * are allowed to depend on. Both the local better-auth instance and the remote
 * HTTP-backed gateway satisfy this shape, so callers never need to know whether
 * auth runs in-process or as a standalone service.
 */
export type AuthGatewayApi = Pick<
  Auth["api"],
  | "getSession"
  | "verifyApiKey"
  | "createApiKey"
  | "updateApiKey"
  | "deleteApiKey"
  | "getFullOrganization"
  | "checkOrganizationSlug"
  | "createOrganization"
  | "deleteOrganization"
>;

export interface AuthGateway {
  api: AuthGatewayApi;
  handler: (request: Request) => Promise<Response>;
}

export interface RemoteAuthGatewayOptions {
  /**
   * Origin of the standalone auth service (e.g. `http://auth.zeabur.internal:3006`),
   * usually `INTERNAL_AUTH_SERVICE_ENDPOINT`.
   */
  baseURL: string;
  /**
   * Path where the better-auth handler is mounted on the auth service.
   * @default "/auth"
   */
  basePath?: string;
  /**
   * Path of the internal (server-only) routes on the auth service.
   * @default "/auth/internal"
   */
  internalBasePath?: string;
  /**
   * Shared secret for internal routes (`INTERNAL_AUTH_SERVICE_TOKEN`).
   * Required for `verifyApiKey`, which better-auth does not expose over HTTP.
   */
  internalToken?: string;
  /**
   * Path where the calling service mounts its auth proxy route. `handler`
   * rewrites incoming paths under this prefix onto `basePath`, e.g.
   * `/api/v1/auth/get-session` → `/auth/get-session`.
   * @default "/api/v1/auth"
   */
  localBasePath?: string;
}

interface CallOptions {
  method: "GET" | "POST";
  headers?: HeadersInit;
  body?: unknown;
  query?: Record<string, string | undefined>;
}

/**
 * Creates an `AuthGateway` backed by the standalone auth service over HTTP.
 *
 * - Session-authenticated operations (get-session, api-key and organization
 *   management) are forwarded to better-auth's public endpoints with the
 *   caller's headers, so the auth service enforces the real authorization.
 *   Server-only body fields (e.g. `userId`) are rejected by better-auth over
 *   HTTP — callers must rely on the forwarded session instead.
 * - `verifyApiKey` is SERVER_ONLY in better-auth, so it goes through the auth
 *   service's internal route, authenticated with the shared internal token.
 * - `handler` reverse-proxies raw requests (sign-in flows, OAuth callbacks)
 *   to the auth service.
 *
 * Failed calls throw better-auth's `APIError` with the upstream status code,
 * matching the behavior of a local better-auth instance.
 */
export const createRemoteAuthGateway = (
  options: RemoteAuthGatewayOptions
): AuthGateway => {
  const {
    baseURL,
    basePath = "/auth",
    internalBasePath = "/auth/internal",
    internalToken,
    localBasePath = "/api/v1/auth",
  } = options;
  const origin = baseURL.replace(/\/$/, "");

  const call = async (url: string, callOptions: CallOptions) => {
    const { method, headers, body, query } = callOptions;
    const target = new URL(url);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          target.searchParams.set(key, value);
        }
      }
    }
    const requestHeaders = sanitizeHeaders(headers);
    if (body !== undefined) {
      requestHeaders.set("content-type", "application/json");
    }
    const response = await fetch(target, {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    const data: unknown = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const errorBody = (data ?? {}) as { code?: string; message?: string };
      throw new APIError(
        response.status as ConstructorParameters<typeof APIError>[0],
        errorBody
      );
    }
    return data;
  };

  const callAuth = (path: string, callOptions: CallOptions) =>
    call(`${origin}${basePath}${path}`, callOptions);

  const callInternal = (path: string, callOptions: CallOptions) => {
    if (!internalToken) {
      throw new APIError("SERVICE_UNAVAILABLE", {
        message: "INTERNAL_AUTH_SERVICE_TOKEN is not configured",
      });
    }
    const headers = sanitizeHeaders(callOptions.headers);
    headers.set(X_CH_INTERNAL_TOKEN, internalToken);
    return call(`${origin}${internalBasePath}${path}`, {
      ...callOptions,
      headers,
    });
  };

  const api = {
    getSession: (context: { headers: HeadersInit }) =>
      callAuth("/get-session", {
        method: "GET",
        headers: context.headers,
      }),
    verifyApiKey: (context: { headers?: HeadersInit; body: unknown }) =>
      callInternal("/verify-api-key", {
        method: "POST",
        headers: context.headers,
        body: context.body,
      }),
    createApiKey: (context: { headers?: HeadersInit; body: unknown }) =>
      callAuth("/api-key/create", {
        method: "POST",
        headers: context.headers,
        body: context.body,
      }),
    updateApiKey: (context: { headers?: HeadersInit; body: unknown }) =>
      callAuth("/api-key/update", {
        method: "POST",
        headers: context.headers,
        body: context.body,
      }),
    deleteApiKey: (context: { headers?: HeadersInit; body: unknown }) =>
      callAuth("/api-key/delete", {
        method: "POST",
        headers: context.headers,
        body: context.body,
      }),
    getFullOrganization: (context: {
      headers?: HeadersInit;
      query?: {
        organizationId?: string;
        organizationSlug?: string;
        membersLimit?: number;
      };
    }) =>
      callAuth("/organization/get-full-organization", {
        method: "GET",
        headers: context.headers,
        query: {
          organizationId: context.query?.organizationId,
          organizationSlug: context.query?.organizationSlug,
          membersLimit:
            context.query?.membersLimit !== undefined
              ? String(context.query.membersLimit)
              : undefined,
        },
      }),
    checkOrganizationSlug: (context: {
      headers?: HeadersInit;
      body: unknown;
    }) =>
      callAuth("/organization/check-slug", {
        method: "POST",
        headers: context.headers,
        body: context.body,
      }),
    createOrganization: (context: { headers?: HeadersInit; body: unknown }) =>
      callAuth("/organization/create", {
        method: "POST",
        headers: context.headers,
        body: context.body,
      }),
    deleteOrganization: (context: { headers?: HeadersInit; body: unknown }) =>
      callAuth("/organization/delete", {
        method: "POST",
        headers: context.headers,
        body: context.body,
      }),
  };

  const handler = async (request: Request) => {
    const url = new URL(request.url);
    // align the incoming path with the auth service's mount path, e.g.
    // `/api/v1/auth/get-session` → `/auth/get-session`
    const pathname = url.pathname.startsWith(localBasePath)
      ? `${basePath}${url.pathname.slice(localBasePath.length)}`
      : url.pathname;
    const target = new URL(`${pathname}${url.search}`, origin);
    // Stream the body through instead of buffering it — the incoming request
    // body can only be consumed once, and reading it here would throw
    // "Body has already been read" if anything upstream touched it (and vice
    // versa). `duplex: "half"` is required by undici/bun for streamed bodies.
    const hasBody =
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      request.body !== null &&
      !request.bodyUsed;
    return await fetch(target, {
      method: request.method,
      headers: sanitizeHeaders(request.headers),
      redirect: "manual",
      ...(hasBody
        ? ({ body: request.body, duplex: "half" } as RequestInit)
        : {}),
    });
  };

  return {
    // The runtime shapes match the subset of the better-auth endpoints we
    // expose, but the endpoint types themselves are generic overloads that
    // cannot be re-implemented structurally.
    api: api as unknown as AuthGatewayApi,
    handler,
  };
};
