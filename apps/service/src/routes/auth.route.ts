import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { timeout } from "hono/timeout";
import * as z from "zod";

import {
  OAuthCodeRefusedError,
  finishOAuthFlow,
  isTrustedOrigin,
  oauthFlowSchema,
  startOAuthFlow,
} from "@chia/auth/oauth";
import { SESSION_COOKIE } from "@chia/auth/session";
import { oauthProviderSchema } from "@chia/auth/types";
import { getCookieDomain, useSecureCookies } from "@chia/auth/utils";
import { reportError } from "@chia/observability/report";
import {
  AppError,
  AppErrorCode,
  toErrorResponse,
} from "@chia/service-kit/errors";
import type { SessionGrant } from "@chia/services/auth/auth.service";
import {
  endSession,
  signInWithOAuth,
  startGuestSession,
} from "@chia/services/auth/auth.service";

import { env } from "../env";
import { resolveCaller } from "../guards/caller.guard";
import { captchaGuard } from "../guards/captcha.guard";
import { rateLimiterGuard } from "../guards/rate-limiter.guard";
import { verifyTrustedOrigin } from "../guards/trusted-origin.guard";
import { errorResponse } from "../utils/error.util";

/**
 * Holds the PKCE verifier and state between the redirect out and the provider's callback.
 * `__Host-` pins it to this host: another subdomain cannot plant a flow of its own, which
 * would sign the visitor in as someone else.
 */
const FLOW_COOKIE = useSecureCookies
  ? "__Host-chia1104.dev.oauth"
  : "chia1104.dev.oauth";
/** `__Host-` requires `Path=/` and no `Domain`. */
const FLOW_COOKIE_SCOPE = { path: "/", secure: useSecureCookies };
const FLOW_MAX_AGE_SECONDS = 600;

const sessionCookieScope = () => ({
  domain: getCookieDomain({ env }),
  path: "/",
  secure: useSecureCookies,
});

const setSessionCookie = (c: Context<HonoContext>, grant: SessionGrant) => {
  setCookie(c, SESSION_COOKIE, grant.token, {
    ...sessionCookieScope(),
    httpOnly: true,
    sameSite: "Lax",
    expires: grant.expiresAt,
  });
};

const failure = (c: Context<HonoContext>, code: AppErrorCode) => {
  const error = new AppError(code);
  return c.json(toErrorResponse(error), error.status);
};

const clientOf = (c: Context<HonoContext>) => ({
  ipAddress: c.var.clientIP === "anonymous" ? null : c.var.clientIP,
  userAgent: c.req.header("User-Agent") ?? null,
});

/** Sends the browser back to where the sign-in started, with `error` set on failure. */
const returnTo = (callbackURL: string, error?: string) => {
  const url = new URL(callbackURL);
  if (error) url.searchParams.set("error", error);
  return url.toString();
};

const socialSignInSchema = z.object({
  provider: oauthProviderSchema,
  callbackURL: z.url(),
});

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const readFlow = (c: Context<HonoContext>) => {
  const raw = getCookie(c, FLOW_COOKIE);
  deleteCookie(c, FLOW_COOKIE, FLOW_COOKIE_SCOPE);
  if (!raw) return null;
  try {
    const parsed = oauthFlowSchema.safeParse(
      JSON.parse(Buffer.from(raw, "base64url").toString("utf8"))
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/** The routes that mint a session for an unknown caller go through the captcha. */
const api = new Hono<HonoContext>()
  .use(timeout(env.TIMEOUT_MS))
  .use(verifyTrustedOrigin({ requireOrigin: true }))
  .use(resolveCaller())
  .use(rateLimiterGuard("auth"))
  .post(
    "/sign-in/social",
    captchaGuard(),
    zValidator("json", socialSignInSchema, (result, c) => {
      if (!result.success) return c.json(errorResponse(result.error), 400);
    }),
    async (c) => {
      const { provider, callbackURL } = c.req.valid("json");
      if (!isTrustedOrigin(callbackURL)) {
        return failure(c, AppErrorCode.BadRequest);
      }

      const started = await startOAuthFlow(provider, callbackURL);
      if (!started) return failure(c, AppErrorCode.NotFound);

      setCookie(
        c,
        FLOW_COOKIE,
        Buffer.from(JSON.stringify(started.flow)).toString("base64url"),
        {
          ...FLOW_COOKIE_SCOPE,
          httpOnly: true,
          sameSite: "Lax",
          maxAge: FLOW_MAX_AGE_SECONDS,
        }
      );
      return c.json({ url: started.url });
    }
  )
  .get("/callback/:provider", async (c) => {
    const flow = readFlow(c);
    const query = callbackQuerySchema.safeParse(c.req.query());
    const provider = oauthProviderSchema.safeParse(c.req.param("provider"));

    // Without a flow there is no trusted place to send the browser back to.
    if (!flow || !isTrustedOrigin(flow.callbackURL)) {
      return failure(c, AppErrorCode.BadRequest);
    }
    if (
      !query.success ||
      !provider.success ||
      provider.data !== flow.provider ||
      query.data.state !== flow.state
    ) {
      return c.redirect(returnTo(flow.callbackURL, "invalid_callback"));
    }

    try {
      const result = await signInWithOAuth(c.var.db, {
        identity: await finishOAuthFlow(flow, query.data.code),
        previousToken: getCookie(c, SESSION_COOKIE) ?? null,
        client: clientOf(c),
      });
      if (!result.ok) {
        return c.redirect(returnTo(flow.callbackURL, result.reason));
      }
      setSessionCookie(c, result.grant);
      return c.redirect(returnTo(flow.callbackURL));
    } catch (error) {
      if (error instanceof OAuthCodeRefusedError) {
        return c.redirect(returnTo(flow.callbackURL, "invalid_callback"));
      }
      reportError(error, "OAuth sign-in failed", {
        provider: flow.provider,
      });
      return c.redirect(returnTo(flow.callbackURL, "sign_in_failed"));
    }
  })
  .post("/sign-in/guest", captchaGuard(), async (c) => {
    const grant = await startGuestSession(c.var.db, {
      previousToken: getCookie(c, SESSION_COOKIE) ?? null,
      client: clientOf(c),
    });
    if (grant) setSessionCookie(c, grant);
    return c.json({ ok: true });
  })
  .post("/sign-out", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await endSession(c.var.db, token);
    deleteCookie(c, SESSION_COOKIE, sessionCookieScope());
    return c.json({ ok: true });
  });

export default api;
