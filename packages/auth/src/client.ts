import "client-only";
import * as z from "zod";

import { withServiceEndpoint } from "@chia/utils/config";
import { Service } from "@chia/utils/schema";

import type { OAuthProvider } from "./types";

export class AuthRequestError extends Error {
  constructor(readonly status: number) {
    super(`Auth request failed with ${status}`);
    this.name = "AuthRequestError";
  }
}

const authEndpoint = (path: string) =>
  withServiceEndpoint(`/auth${path}`, Service.LegacyService, {
    isInternal: false,
    version: "LEGACY",
  });

const post = async (
  path: string,
  options: { body?: unknown; headers?: Record<string, string> } = {}
) => {
  const response = await fetch(authEndpoint(path), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    body: JSON.stringify(options.body ?? {}),
  });
  if (!response.ok) throw new AuthRequestError(response.status);
  return response;
};

const redirectSchema = z.object({ url: z.url() });

/** Sends the browser to the provider; the service redirects back to `callbackURL` afterwards. */
export const signInSocial = async (input: {
  provider: OAuthProvider;
  callbackURL: string;
  headers?: Record<string, string>;
}) => {
  const response = await post("/sign-in/social", {
    body: { provider: input.provider, callbackURL: input.callbackURL },
    headers: input.headers,
  });
  // A proxy error page is not JSON; treat it as the failure it is.
  const parsed = redirectSchema.safeParse(
    await response.json().catch(() => null)
  );
  if (!parsed.success) throw new AuthRequestError(response.status);
  window.location.assign(parsed.data.url);
};

/** Mints a guest session cookie, or keeps the session the browser already holds. */
export const signInGuest = async (input: {
  headers?: Record<string, string>;
}) => {
  await post("/sign-in/guest", { headers: input.headers });
};

export const signOut = async () => {
  await post("/sign-out");
};
