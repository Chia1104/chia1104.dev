import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { ApiKeyScope, hashApiKey } from "@chia/auth/apikey";
import { hashSessionToken } from "@chia/auth/session";
import { CallerTier } from "@chia/auth/tier";
import { serviceContextOf } from "@chia/test/context";
import type { TestSession } from "@chia/test/session";
import { sessionOf } from "@chia/test/session";

import type { ServiceContext } from "../src/context";
import { AppErrorCode } from "../src/errors";
import { apiKeyPolicy } from "../src/policies/apikey.policy";
import type { Caller } from "../src/policies/caller.policy";
import { callerPolicy } from "../src/policies/caller.policy";
import {
  CaptchaErrorCode,
  captchaPolicy,
} from "../src/policies/captcha.policy";
import type { RateLimitContext } from "../src/policies/rate-limit.policy";
import { rateLimitPolicy } from "../src/policies/rate-limit.policy";
import { sessionPolicy } from "../src/policies/session.policy";

const { repos } = vi.hoisted(() => ({
  repos: {
    findSession: vi.fn(),
    findApiKeyByHash: vi.fn(),
    touchApiKey: vi.fn(),
  },
}));

vi.mock("@chia/db/repos/auth", () => ({ findSession: repos.findSession }));
vi.mock("@chia/db/repos/apikey", () => ({
  findApiKeyByHash: repos.findApiKeyByHash,
  touchApiKey: repos.touchApiKey,
}));

/** `getAdminId()` under the stubbed env. */
const ADMIN_ID = "admin-1";

beforeAll(() => {
  vi.stubEnv("SKIP_ENV_VALIDATION", "true");
  vi.stubEnv("ENV", "test");
  vi.stubEnv("LOCAL_ADMIN_ID", ADMIN_ID);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.clearAllMocks();
  repos.findSession.mockResolvedValue(null);
  repos.findApiKeyByHash.mockResolvedValue(null);
  repos.touchApiKey.mockResolvedValue(undefined);
});

const session = (options: { id?: string; isAnonymous?: boolean } = {}) =>
  sessionOf(options.id ?? "u1", { isAnonymous: options.isAnonymous });

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

/** Stand-ins for the session and Keyv members the policies call. */
interface Fakes {
  session?: TestSession;
  kv?: ReturnType<typeof makeKv>;
}

const makeContext = <TContext extends ServiceContext = ServiceContext>(
  fakes: Partial<Omit<TContext, keyof Fakes>> & Fakes = {}
) =>
  serviceContextOf<TContext>(
    /* SAFETY: each fake implements every member the policy under test reads. */ fakes as never
  );

const withSession = (value: TestSession) => makeContext({ session: value });

describe("sessionPolicy", () => {
  it("denies with UNAUTHORIZED when there is no session", async () => {
    const result = await sessionPolicy()(makeContext());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(AppErrorCode.Unauthorized);
    expect(repos.findSession).not.toHaveBeenCalled();
  });

  it("looks the cookie's token up by its hash, never the raw value", async () => {
    repos.findSession.mockResolvedValue(session());

    const result = await sessionPolicy()(
      makeContext({
        headers: new Headers({ Cookie: "other=1; chia1104.dev.session=tok" }),
      })
    );

    expect(result.ok).toBe(true);
    expect(repos.findSession).toHaveBeenCalledWith(
      expect.anything(),
      await hashSessionToken("tok")
    );
  });

  it("reuses a session already on the context instead of looking it up", async () => {
    const result = await sessionPolicy()(
      makeContext({
        session: session(),
        headers: new Headers({ Cookie: "chia1104.dev.session=tok" }),
      })
    );

    expect(repos.findSession).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("treats a guest as not signed in unless the caller admits guests", async () => {
    const context = withSession(session({ isAnonymous: true }));

    const refused = await sessionPolicy()(context);
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.error.code).toBe(AppErrorCode.Unauthorized);

    const admitted = await sessionPolicy({ allowAnonymous: true })(context);
    expect(admitted.ok).toBe(true);
  });

  it("denies with FORBIDDEN when rootOnly is set and the user is not the admin", async () => {
    const result = await sessionPolicy({ rootOnly: true })(
      withSession(session())
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(AppErrorCode.Forbidden);
  });

  it("allows the configured admin when rootOnly is set", async () => {
    const result = await sessionPolicy({ rootOnly: true })(
      withSession(session({ id: ADMIN_ID }))
    );

    expect(result.ok).toBe(true);
  });
});

describe("rateLimitPolicy", () => {
  const anonymous: Caller = { tier: CallerTier.Anonymous, adminId: "admin-1" };
  const root: Caller = { tier: CallerTier.Root, adminId: "admin-1" };

  const budget = { windowMs: 60_000, limit: { [CallerTier.Anonymous]: 2 } };

  const contextFor = (caller: Caller, kv?: ReturnType<typeof makeKv>) =>
    makeContext<RateLimitContext>({ caller, kv });

  const policy = (kv?: ReturnType<typeof makeKv>, caller: Caller = anonymous) =>
    rateLimitPolicy({ ...budget, prefix: "test" })(contextFor(caller, kv));

  it("never counts a tier the budget does not name", async () => {
    const kv = makeKv();

    const result = await policy(kv, root);

    expect(result.ok).toBe(true);
    expect(result.ok && result.headers).toBeUndefined();
    expect(kv.set).not.toHaveBeenCalled();
  });

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
    expect(third.error.code).toBe(AppErrorCode.TooManyRequests);
    expect(third.error.status).toBe(429);
    expect(Number(third.error.headers?.["Retry-After"])).toBeGreaterThan(0);
  });

  it("namespaces counters by prefix so route families do not share a budget", async () => {
    const kv = makeKv();

    const one = { windowMs: 60_000, limit: { [CallerTier.Anonymous]: 1 } };

    await rateLimitPolicy({ ...one, prefix: "a" })(contextFor(anonymous, kv));
    const other = await rateLimitPolicy({ ...one, prefix: "b" })(
      contextFor(anonymous, kv)
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
    expect(result.error.issues?.[0]?.message).toBe(CaptchaErrorCode.Required);
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
    expect(result.error.issues?.[0]?.message).toBe(CaptchaErrorCode.Failed);
  });
});

describe("callerPolicy", () => {
  it("grades a guest session as Guest — above anonymous, below an API key", async () => {
    const result = await callerPolicy()(
      withSession(session({ isAnonymous: true }))
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.patch.caller.tier).toBe(CallerTier.Guest);
    expect(CallerTier.Guest).toBeGreaterThan(CallerTier.Anonymous);
    expect(CallerTier.Guest).toBeLessThan(CallerTier.ApiKey);
  });

  it("grades a signed-in person as Session and the configured admin as Root", async () => {
    const person = await callerPolicy()(withSession(session()));
    expect(person.ok && person.patch.caller.tier).toBe(CallerTier.Session);

    const admin = await callerPolicy()(withSession(session({ id: ADMIN_ID })));
    expect(admin.ok && admin.patch.caller.tier).toBe(CallerTier.Root);
  });

  it("refuses a guest below a required Session tier as FORBIDDEN, not UNAUTHORIZED", async () => {
    const result = await callerPolicy({ minTier: CallerTier.Session })(
      withSession(session({ isAnonymous: true }))
    );
    expect(!result.ok && result.error.code).toBe(AppErrorCode.Forbidden);
  });

  it("treats an expired or unknown cookie as an ordinary visitor", async () => {
    const result = await callerPolicy()(
      makeContext({
        headers: new Headers({ Cookie: "chia1104.dev.session=stale" }),
      })
    );
    expect(result.ok && result.patch.caller.tier).toBe(CallerTier.Anonymous);
  });

  it("grades a pre-resolved caller without touching credentials", async () => {
    const caller: Caller = { tier: CallerTier.Guest, adminId: ADMIN_ID };
    const context = makeContext({
      caller,
      headers: new Headers({ Cookie: "chia1104.dev.session=abc" }),
    });

    const admitted = await callerPolicy()(context);
    expect(admitted.ok && admitted.patch.caller).toBe(caller);

    const refused = await callerPolicy({ minTier: CallerTier.Session })(
      context
    );
    expect(!refused.ok && refused.error.code).toBe(AppErrorCode.Forbidden);
    expect(repos.findSession).not.toHaveBeenCalled();
  });
});

const keyRow = (
  overrides: Partial<{
    userId: string;
    scopes: string[];
    enabled: boolean;
    expiresAt: Date | null;
  }> = {}
) => ({
  id: "k1",
  userId: "u1",
  scopes: [ApiKeyScope.FeedsRead],
  enabled: true,
  expiresAt: null,
  ...overrides,
});

const withKey = (header = "ch_test") =>
  makeContext({ headers: new Headers({ "x-ch-api-key": header }) });

describe("apiKeyPolicy", () => {
  it("denies with UNAUTHORIZED when no key header is sent", async () => {
    const result = await apiKeyPolicy()(makeContext());
    expect(!result.ok && result.error.code).toBe(AppErrorCode.Unauthorized);
  });

  it("looks the key up by its hash and hands the owner and scopes downstream", async () => {
    repos.findApiKeyByHash.mockResolvedValue(keyRow());

    const result = await apiKeyPolicy()(withKey());

    expect(repos.findApiKeyByHash).toHaveBeenCalledWith(
      expect.anything(),
      await hashApiKey("ch_test")
    );
    expect(result.ok && result.patch.apiKey).toEqual({
      id: "k1",
      userId: "u1",
      scopes: [ApiKeyScope.FeedsRead],
    });
    expect(repos.touchApiKey).toHaveBeenCalledWith(expect.anything(), "k1");
  });

  it("answers NOT_FOUND for a key nobody holds", async () => {
    const result = await apiKeyPolicy()(withKey());
    expect(!result.ok && result.error.code).toBe(AppErrorCode.NotFound);
  });

  it("refuses a valid key that lacks a required scope as FORBIDDEN", async () => {
    repos.findApiKeyByHash.mockResolvedValue(keyRow());

    const result = await apiKeyPolicy({ scopes: [ApiKeyScope.FeedsWrite] })(
      withKey()
    );

    expect(!result.ok && result.error.code).toBe(AppErrorCode.Forbidden);
    expect(!result.ok && result.error.issues?.[0]?.code).toBe("SCOPE_MISSING");
  });

  it("ignores a stored scope the code has no name for", async () => {
    repos.findApiKeyByHash.mockResolvedValue(
      keyRow({ scopes: ["feeds:publish"] })
    );

    const result = await apiKeyPolicy({ scopes: [ApiKeyScope.FeedsRead] })(
      withKey()
    );
    expect(!result.ok && result.error.code).toBe(AppErrorCode.Forbidden);
  });

  it("refuses a disabled or expired key as FORBIDDEN", async () => {
    repos.findApiKeyByHash.mockResolvedValueOnce(keyRow({ enabled: false }));
    const disabled = await apiKeyPolicy()(withKey());
    expect(!disabled.ok && disabled.error.issues?.[0]?.code).toBe(
      "KEY_DISABLED"
    );

    repos.findApiKeyByHash.mockResolvedValueOnce(
      keyRow({ expiresAt: new Date(Date.now() - 1000) })
    );
    const expired = await apiKeyPolicy()(withKey());
    expect(!expired.ok && expired.error.issues?.[0]?.code).toBe("KEY_EXPIRED");
    expect(repos.touchApiKey).not.toHaveBeenCalled();
  });
});

describe("callerPolicy with an API key", () => {
  const withOwnedKey = (userId: string, scopes: string[]) => {
    repos.findApiKeyByHash.mockResolvedValue(keyRow({ userId, scopes }));
    return withKey();
  };

  it("lifts an admin-owned key carrying operator:root to Root", async () => {
    const result = await callerPolicy({ minTier: CallerTier.Root })(
      withOwnedKey(ADMIN_ID, [ApiKeyScope.OperatorRoot])
    );
    expect(result.ok && result.patch.caller.tier).toBe(CallerTier.Root);
    expect(result.ok && result.patch.caller.apiKey?.userId).toBe(ADMIN_ID);
  });

  it("asks no scopes of a key lifted to Root but every scope of a plain key", async () => {
    const lifted = await callerPolicy({ scopes: [ApiKeyScope.FeedsWrite] })(
      withOwnedKey(ADMIN_ID, [ApiKeyScope.OperatorRoot])
    );
    expect(lifted.ok && lifted.patch.caller.tier).toBe(CallerTier.Root);

    const plain = await callerPolicy({ scopes: [ApiKeyScope.FeedsWrite] })(
      withOwnedKey(ADMIN_ID, [ApiKeyScope.FeedsRead])
    );
    expect(!plain.ok && plain.error.code).toBe(AppErrorCode.Forbidden);
  });

  it("keeps operator:root at ApiKey when someone else owns the key", async () => {
    const result = await callerPolicy()(
      withOwnedKey("user-2", [ApiKeyScope.OperatorRoot])
    );
    expect(result.ok && result.patch.caller.tier).toBe(CallerTier.ApiKey);
  });

  it("keeps an admin-owned key without the scope at ApiKey", async () => {
    const result = await callerPolicy()(
      withOwnedKey(ADMIN_ID, [ApiKeyScope.FeedsRead])
    );
    expect(result.ok && result.patch.caller.tier).toBe(CallerTier.ApiKey);
  });
});
