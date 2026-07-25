import { vi } from "vitest";

/**
 * `apps/dash` imports the oRPC router to build its in-process RSC client, and has no
 * Algolia / Resend configuration of its own. Importing the router therefore must not
 * construct those clients.
 *
 * This guards the regression where `packages/api/algolia/client.ts` called
 * `algoliasearch()` at module scope and threw `` `appId` is missing `` during dash's
 * instrumentation hook — a failure that happened despite Algolia's env schema treating
 * the credentials as optional, so env validation alone would not have caught it.
 */
describe("oRPC router import", () => {
  it("does not construct the Algolia or Resend clients", async () => {
    vi.resetModules();
    // Unrelated integrations (S3, Spotify) validate their own env at import; this test
    // is only about the two clients that are built lazily.
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    vi.stubEnv("ALGOLIA_APPLICATION_ID", "");
    vi.stubEnv("ALGOLIA_API_KEY", "");
    vi.stubEnv("RESEND_API_KEY", "");

    const { router } = await import("../orpc/router");

    expect(Object.keys(router)).toEqual(
      expect.arrayContaining(["content", "email", "toolings", "media"])
    );

    vi.unstubAllEnvs();
  });
});
