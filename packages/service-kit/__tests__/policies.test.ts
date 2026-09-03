import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { serviceContextOf } from "@chia/test/context";
import { sessionOf } from "@chia/test/session";

import type { ServiceContext } from "../src/context";
import { captchaPolicy } from "../src/policies/captcha.policy";
import { rateLimitPolicy } from "../src/policies/rate-limit.policy";
import { sessionPolicy } from "../src/policies/session.policy";

const session = (role: string, isAnonymous = false) => ({
  ...sessionOf("u1", role),
  user: { id: "u1", role, isAnonymous },
});

const makeContext = (overrides?: Partial<ServiceContext>) =>
  serviceContextOf<ServiceContext>(overrides);

const withSession = (value: ReturnType<typeof session>) =>
  makeContext({
    session:
      /* SAFETY: This fixture implements the Session members the policies read. */ value as never,
  });

const makeKv = () => {
  const store = new Map<string, object>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key))),
    set: vi.fn(<TValue extends object>(key: string, value: TValue) => {
      store.set(key, value);
      return Promise.resolve(true);
    }),
  };
};

describe("sessionPolicy", () => {
  it("denies with UNAUTHORIZED when there is no session", async () => {
    const result = await sessionPolicy()(makeContext());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UNAUTHORIZED");
  });

  it("reuses a session already on the context instead of calling better-auth", async () => {
    const getSession = vi.fn();
    const result = await sessionPolicy()(
      makeContext({
        session:
          /* SAFETY: This fixture implements the never members exercised by this case. */ session(
            "admin"
          ) as never,
        auth: /* SAFETY: This fixture implements the never members exercised by this case. */ {
          api: { getSession },
        } as never,
      })
    );

    expect(getSession).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("treats a guest as not signed in unless the caller admits guests", async () => {
    const context = withSession(session("user", true));

    const refused = await sessionPolicy()(context);
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.error.code).toBe("UNAUTHORIZED");

    const admitted = await sessionPolicy({ allowAnonymous: true })(context);
    expect(admitted.ok).toBe(true);
  });

  it("denies with FORBIDDEN when rootOnly is set and the role is not root", async () => {
    const result = await sessionPolicy({ rootOnly: true })(
      makeContext({
        session:
          /* SAFETY: This fixture implements the never members exercised by this case. */ session(
            "admin"
          ) as never,
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("allows root when rootOnly is set", async () => {
    const result = await sessionPolicy({ rootOnly: true })(
      makeContext({
        session:
          /* SAFETY: This fixture implements the never members exercised by this case. */ session(
            "root"
          ) as never,
      })
    );

    expect(result.ok).toBe(true);
  });
});

describe("rateLimitPolicy", () => {
  const policy = (kv?: ReturnType<typeof makeKv>) =>
    rateLimitPolicy({ windowMs: 60_000, limit: 2, prefix: "test" })(
      makeContext({
        kv: /* SAFETY: This fixture implements the never members exercised by this case. */ kv as never,
      })
    );

  it("fails open when there is no store rather than locking callers out", async () => {
    const result = await policy(undefined);
    expect(result.ok).toBe(true);
  });

  it("reports the remaining budget in draft-6 headers", async () => {
    const kv = makeKv();

    const first = await policy(kv);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.headers?.["RateLimit-Limit"]).toBe("2");
    expect(first.headers?.["RateLimit-Remaining"]).toBe("1");

    const second = await policy(kv);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.headers?.["RateLimit-Remaining"]).toBe("0");
  });

  it("denies with 429 and Retry-After once the limit is exceeded", async () => {
    const kv = makeKv();

    await policy(kv);
    await policy(kv);
    const third = await policy(kv);

    expect(third.ok).toBe(false);
    if (third.ok) return;
    expect(third.error.code).toBe("TOO_MANY_REQUESTS");
    expect(third.error.status).toBe(429);
    expect(Number(third.error.headers?.["Retry-After"])).toBeGreaterThan(0);
  });

  it("namespaces counters by prefix so route families do not share a budget", async () => {
    const kv = makeKv();

    await rateLimitPolicy({ windowMs: 60_000, limit: 1, prefix: "a" })(
      makeContext({
        kv: /* SAFETY: This fixture implements the never members exercised by this case. */ kv as never,
      })
    );
    const other = await rateLimitPolicy({
      windowMs: 60_000,
      limit: 1,
      prefix: "b",
    })(
      makeContext({
        kv: /* SAFETY: This fixture implements the never members exercised by this case. */ kv as never,
      })
    );

    expect(other.ok).toBe(true);
  });
});

describe("captchaPolicy", () => {
  const verify = vi.fn();

  it("denies when no token was supplied", async () => {
    const result = await captchaPolicy({ verify, token: undefined })(
      makeContext()
    );

    expect(verify).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.issues?.[0]?.message).toBe("CAPTCHA_REQUIRED");
  });

  it("passes the client IP through to the verifier", async () => {
    verify.mockResolvedValueOnce({ success: true });

    const result = await captchaPolicy({ verify, token: "token-123" })(
      makeContext()
    );

    expect(verify).toHaveBeenCalledWith({
      token: "token-123",
      remoteip: "1.2.3.4",
    });
    expect(result.ok).toBe(true);
  });

  it("denies with CAPTCHA_FAILED when the provider rejects the token", async () => {
    verify.mockResolvedValueOnce({ success: false });

    const result = await captchaPolicy({ verify, token: "bad" })(makeContext());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.issues?.[0]?.message).toBe("CAPTCHA_FAILED");
  });
});

describe("callerPolicy", () => {
  const ADMIN_ID = "admin-1";

  beforeAll(() => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    vi.stubEnv("ENV", "test");
    vi.stubEnv("LOCAL_ADMIN_ID", ADMIN_ID);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("grades a guest session as Guest — above anonymous, below an API key", async () => {
    const { callerPolicy, CallerTier } =
      await import("../src/policies/caller.policy");
    const result = await callerPolicy()(withSession(session("user", true)));

    expect(result.ok).toBe(true);
    expect(result.ok && result.patch?.caller.tier).toBe(CallerTier.Guest);
    expect(CallerTier.Guest).toBeGreaterThan(CallerTier.Anonymous);
    expect(CallerTier.Guest).toBeLessThan(CallerTier.ApiKey);
  });

  it("grades a signed-in person as Session and the configured admin as Root", async () => {
    const { callerPolicy, CallerTier } =
      await import("../src/policies/caller.policy");
    const person = await callerPolicy()(withSession(session("user")));
    expect(person.ok && person.patch?.caller.tier).toBe(CallerTier.Session);

    const admin = await callerPolicy()(
      withSession({
        session: { id: "s2", userId: ADMIN_ID },
        user: { id: ADMIN_ID, role: "root", isAnonymous: false },
      })
    );
    expect(admin.ok && admin.patch?.caller.tier).toBe(CallerTier.Root);
  });

  it("refuses a guest below a required Session tier as FORBIDDEN, not UNAUTHORIZED", async () => {
    const { callerPolicy, CallerTier } =
      await import("../src/policies/caller.policy");
    const result = await callerPolicy({ minTier: CallerTier.Session })(
      withSession(session("user", true))
    );
    expect(!result.ok && result.error.code).toBe("FORBIDDEN");
  });
});

describe("apiKeyPolicy", () => {
  const verifiedKey = (permissions: Record<string, string[]> | null) => ({
    valid: true,
    error: null,
    key: { id: "k1", referenceId: "u1", permissions },
  });

  type VerifyResult =
    | ReturnType<typeof verifiedKey>
    | { valid: false; error: { code: string; message: string }; key: null };

  const withKey = (
    verifyApiKey: () => Promise<VerifyResult>,
    header = "ch_test"
  ) =>
    makeContext({
      headers: new Headers({ "x-ch-api-key": header }),
      auth: /* SAFETY: This fixture implements the better-auth surface the policy calls. */ {
        api: { verifyApiKey },
      } as never,
    });

  it("denies with UNAUTHORIZED when no key header is sent", async () => {
    const { apiKeyPolicy } = await import("../src/policies/apikey.policy");
    const result = await apiKeyPolicy()(makeContext());
    expect(!result.ok && result.error.code).toBe("UNAUTHORIZED");
  });

  it("verifies the key with better-auth and hands the parsed row downstream", async () => {
    const { apiKeyPolicy } = await import("../src/policies/apikey.policy");
    const verifyApiKey = vi.fn(() =>
      Promise.resolve(verifiedKey({ feeds: ["read"] }))
    );
    const result = await apiKeyPolicy()(withKey(verifyApiKey));

    expect(verifyApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ body: { key: "ch_test" } })
    );
    expect(result.ok && result.patch?.apiKey.permissions).toEqual({
      feeds: ["read"],
    });
  });

  it("refuses a valid key that lacks a required scope as FORBIDDEN", async () => {
    const { apiKeyPolicy } = await import("../src/policies/apikey.policy");
    const result = await apiKeyPolicy({ scopes: ["feeds:write"] })(
      withKey(() => Promise.resolve(verifiedKey({ feeds: ["read"] })))
    );

    expect(!result.ok && result.error.code).toBe("FORBIDDEN");
    expect(!result.ok && result.error.issues?.[0]?.code).toBe("SCOPE_MISSING");
  });

  it("refuses a key created before scopes existed when a scope is required", async () => {
    const { apiKeyPolicy } = await import("../src/policies/apikey.policy");
    const result = await apiKeyPolicy({ scopes: ["feeds:read"] })(
      withKey(() => Promise.resolve(verifiedKey(null)))
    );
    expect(!result.ok && result.error.code).toBe("FORBIDDEN");
  });

  it("maps better-auth's KEY_DISABLED onto FORBIDDEN", async () => {
    const { apiKeyPolicy } = await import("../src/policies/apikey.policy");
    const result = await apiKeyPolicy()(
      withKey(() =>
        Promise.resolve({
          valid: false,
          error: { code: "KEY_DISABLED", message: "disabled" },
          key: null,
        })
      )
    );
    expect(!result.ok && result.error.code).toBe("FORBIDDEN");
  });
});

describe("callerPolicy with an API key", () => {
  const ADMIN_ID = "admin-1";

  beforeAll(() => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    vi.stubEnv("ENV", "test");
    vi.stubEnv("LOCAL_ADMIN_ID", ADMIN_ID);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  const withVerifiedKey = (key: {
    referenceId: string;
    permissions: Record<string, string[]> | null;
  }) =>
    makeContext({
      headers: new Headers({ "x-ch-api-key": "ch_test" }),
      auth: /* SAFETY: This fixture implements the better-auth surface the policy calls. */ {
        api: {
          verifyApiKey: () =>
            Promise.resolve({
              valid: true,
              error: null,
              key: { id: "k1", ...key },
            }),
        },
      } as never,
    });

  it("lifts an admin-owned key carrying operator:root to Root", async () => {
    const { callerPolicy, CallerTier } =
      await import("../src/policies/caller.policy");
    const result = await callerPolicy({ minTier: CallerTier.Root })(
      withVerifiedKey({
        referenceId: ADMIN_ID,
        permissions: { operator: ["root"] },
      })
    );
    expect(result.ok && result.patch?.caller.tier).toBe(CallerTier.Root);
    expect(result.ok && result.patch?.caller.apiKey?.referenceId).toBe(
      ADMIN_ID
    );
  });

  it("asks no scopes of a key lifted to Root but every scope of a plain key", async () => {
    const { callerPolicy, CallerTier } =
      await import("../src/policies/caller.policy");
    const lifted = await callerPolicy({ scopes: ["feeds:write"] })(
      withVerifiedKey({
        referenceId: ADMIN_ID,
        permissions: { operator: ["root"] },
      })
    );
    expect(lifted.ok && lifted.patch?.caller.tier).toBe(CallerTier.Root);

    const plain = await callerPolicy({ scopes: ["feeds:write"] })(
      withVerifiedKey({
        referenceId: ADMIN_ID,
        permissions: { feeds: ["read"] },
      })
    );
    expect(!plain.ok && plain.error.code).toBe("FORBIDDEN");
  });

  it("keeps operator:root at ApiKey when someone else owns the key", async () => {
    const { callerPolicy, CallerTier } =
      await import("../src/policies/caller.policy");
    const result = await callerPolicy()(
      withVerifiedKey({
        referenceId: "user-2",
        permissions: { operator: ["root"] },
      })
    );
    expect(result.ok && result.patch?.caller.tier).toBe(CallerTier.ApiKey);
  });

  it("keeps an admin-owned key without the scope at ApiKey", async () => {
    const { callerPolicy, CallerTier } =
      await import("../src/policies/caller.policy");
    const result = await callerPolicy()(
      withVerifiedKey({
        referenceId: ADMIN_ID,
        permissions: { feeds: ["read"] },
      })
    );
    expect(result.ok && result.patch?.caller.tier).toBe(CallerTier.ApiKey);
  });
});
