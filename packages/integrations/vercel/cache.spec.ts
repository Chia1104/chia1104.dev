import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Pins the invalidate-by-tags wire shape, its failure as `VercelApiError`, and that a
 * partly configured project exports no invalidation at all.
 */

const loadCache = async (env: Record<string, string | undefined>) => {
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) {
    vi.stubEnv(name, value);
  }
  return import("./cache");
};

const configured = {
  VERCEL_TOKEN: "tok",
  VERCEL_TEAM_ID: "team_1",
  VERCEL_PROJECT_ID: "prj_1",
};

const stubFetch = (response: Response) => {
  const calls: Request[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push(new Request(input, init));
      return response;
    })
  );
  return calls;
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("invalidateCacheTags", () => {
  it("invalidates the tags in production for the configured project", async () => {
    const calls = stubFetch(new Response("{}", { status: 200 }));
    const { invalidateCacheTags } = await loadCache(configured);

    await invalidateCacheTags?.(["content"]);

    expect(calls).toHaveLength(1);
    const [request] = calls;
    expect(request?.method).toBe("POST");
    expect(request?.url).toBe(
      "https://api.vercel.com/v1/edge-cache/invalidate-by-tags?projectIdOrName=prj_1&teamId=team_1"
    );
    expect(request?.headers.get("authorization")).toBe("Bearer tok");
    expect(await request?.json()).toEqual({
      tags: ["content"],
      target: "production",
    });
  });

  it("throws VercelApiError with the response status", async () => {
    stubFetch(new Response("{}", { status: 403 }));
    const { VercelApiError, invalidateCacheTags } = await loadCache(configured);

    const failure = invalidateCacheTags?.(["content"]);

    await expect(failure).rejects.toBeInstanceOf(VercelApiError);
    await expect(failure).rejects.toMatchObject({ status: 403 });
  });

  it("is null when a variable is blank, as `.env.example` leaves them", async () => {
    const { invalidateCacheTags } = await loadCache({
      VERCEL_TOKEN: "",
      VERCEL_TEAM_ID: "",
      VERCEL_PROJECT_ID: "",
    });

    expect(invalidateCacheTags).toBeNull();
  });

  it("is null when any of the three variables is unset", async () => {
    const { invalidateCacheTags } = await loadCache({
      ...configured,
      VERCEL_PROJECT_ID: undefined,
    });

    expect(invalidateCacheTags).toBeNull();
  });
});
