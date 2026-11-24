import * as z from "zod";

import type { OAuthIdentity } from "@chia/db/repos/auth";

import { randomToken, sha256 } from "./crypto";
import { env } from "./env";
import { OAuthProvider } from "./types";

/** What the callback needs to finish a sign-in, carried in the flow cookie. */
export const oauthFlowSchema = z.object({
  provider: z.enum(OAuthProvider),
  state: z.string().min(32),
  codeVerifier: z.string().min(43),
  callbackURL: z.url(),
});

export type OAuthFlow = z.infer<typeof oauthFlowSchema>;

interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizeURL: string;
  scope: string;
  exchange: (input: {
    code: string;
    codeVerifier: string;
    redirectURI: string;
  }) => Promise<OAuthIdentity | null>;
}

const tokenSchema = z.object({ access_token: z.string().min(1) });

const tokenErrorSchema = z.object({ error: z.string() });

/** How a provider names a code it will not redeem: RFC 6749's name, then GitHub's. */
const REFUSED_CODE_ERRORS = new Set(["invalid_grant", "bad_verification_code"]);

/** The provider would not redeem the code: forged, replayed or expired. The caller's failure. */
export class OAuthCodeRefusedError extends Error {
  constructor() {
    super("OAuth provider refused the authorization code");
    this.name = "OAuthCodeRefusedError";
  }
}

/**
 * Lowercases a plain ASCII address. The shape is checked before any case folding, so an
 * address in other characters is refused, never folded into one that already has an account.
 */
const canonicalEmail = (raw: string): string | null => {
  const email = raw.trim();
  return /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(
    email
  ) && email.length <= 254
    ? email.toLowerCase()
    : null;
};

const fetchJSON = async <T>(
  schema: z.ZodType<T>,
  input: string,
  init: RequestInit
): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(`OAuth request failed: ${response.status} ${input}`);
  }
  return schema.parse(await response.json());
};

const exchangeToken = async (
  url: string,
  body: Record<string, string>
): Promise<string> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  // Google refuses a code with 400 and GitHub with 200; both name the reason in `error`.
  const payload: unknown = await response.json().catch(() => null);
  const refusal = tokenErrorSchema.safeParse(payload);
  if (refusal.success && REFUSED_CODE_ERRORS.has(refusal.data.error)) {
    throw new OAuthCodeRefusedError();
  }
  if (!response.ok) {
    throw new Error(`OAuth request failed: ${response.status} ${url}`);
  }
  return tokenSchema.parse(payload).access_token;
};

const googleUserSchema = z.object({
  sub: z.string().min(1),
  email: z.string(),
  email_verified: z.boolean(),
  name: z.string().optional(),
  picture: z.string().optional(),
});

const google = (): ProviderConfig => ({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  authorizeURL: "https://accounts.google.com/o/oauth2/v2/auth",
  scope: "openid email profile",
  exchange: async ({ code, codeVerifier, redirectURI }) => {
    const accessToken = await exchangeToken(
      "https://oauth2.googleapis.com/token",
      {
        grant_type: "authorization_code",
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectURI,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
      }
    );
    const profile = await fetchJSON(
      googleUserSchema,
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const email = profile.email_verified ? canonicalEmail(profile.email) : null;
    if (!email) return null;
    return {
      providerId: OAuthProvider.Google,
      accountId: profile.sub,
      email,
      name: profile.name ?? email,
      image: profile.picture ?? null,
    };
  },
});

const githubUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullable(),
  avatar_url: z.string().nullable(),
});

const githubEmailsSchema = z.array(
  z.object({ email: z.string(), primary: z.boolean(), verified: z.boolean() })
);

const github = (): ProviderConfig | null => {
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    authorizeURL: "https://github.com/login/oauth/authorize",
    scope: "read:user user:email",
    exchange: async ({ code, codeVerifier, redirectURI }) => {
      const accessToken = await exchangeToken(
        "https://github.com/login/oauth/access_token",
        {
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectURI,
          client_id: clientId,
          client_secret: clientSecret,
        }
      );
      // GitHub rejects API calls without a User-Agent.
      const headers = {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "chia1104.dev",
      };
      const [profile, emails] = await Promise.all([
        fetchJSON(githubUserSchema, "https://api.github.com/user", {
          headers,
        }),
        fetchJSON(githubEmailsSchema, "https://api.github.com/user/emails", {
          headers,
        }),
      ]);
      const primary = emails.find((entry) => entry.primary && entry.verified);
      const email = primary ? canonicalEmail(primary.email) : null;
      if (!email) return null;
      return {
        providerId: OAuthProvider.GitHub,
        accountId: String(profile.id),
        email,
        name: profile.name ?? profile.login,
        image: profile.avatar_url,
      };
    },
  };
};

const providerConfig = (provider: OAuthProvider): ProviderConfig | null => {
  switch (provider) {
    case OAuthProvider.Google:
      return google();
    case OAuthProvider.GitHub:
      return github();
  }
};

export const isOAuthProviderEnabled = (provider: OAuthProvider) =>
  providerConfig(provider) !== null;

/** The provider redirects here; built on `AUTH_URL` so a forged `Host` cannot move it. */
export const oauthRedirectURI = (provider: OAuthProvider) =>
  `${new URL(env.AUTH_URL).origin}/api/v1/auth/callback/${provider}`;

/** Starts a flow: the URL to send the browser to, and the flow the callback must match. */
export const startOAuthFlow = async (
  provider: OAuthProvider,
  callbackURL: string
): Promise<{ url: string; flow: OAuthFlow } | null> => {
  const config = providerConfig(provider);
  if (!config) return null;

  const flow: OAuthFlow = {
    provider,
    state: randomToken(),
    codeVerifier: randomToken(),
    callbackURL,
  };
  const url = new URL(config.authorizeURL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: oauthRedirectURI(provider),
    scope: config.scope,
    state: flow.state,
    code_challenge: await sha256(flow.codeVerifier),
    code_challenge_method: "S256",
  }).toString();
  return { url: url.toString(), flow };
};

/**
 * Trades the authorization code for the identity it belongs to. `null` means the provider
 * holds no verified email for it, so it cannot sign in.
 */
export const finishOAuthFlow = async (
  flow: OAuthFlow,
  code: string
): Promise<OAuthIdentity | null> => {
  const config = providerConfig(flow.provider);
  if (!config) return null;
  return await config.exchange({
    code,
    codeVerifier: flow.codeVerifier,
    redirectURI: oauthRedirectURI(flow.provider),
  });
};

/** Origins a sign-in may return to; the browser's own origin is never trusted implicitly. */
export const trustedOrigins = (): string[] =>
  (env.CORS_ALLOWED_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

export const isTrustedOrigin = (value: string | null | undefined) => {
  if (!value) return false;
  try {
    return trustedOrigins().includes(new URL(value).origin);
  } catch {
    return false;
  }
};
