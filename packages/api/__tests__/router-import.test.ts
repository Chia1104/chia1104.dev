import { vi } from "vitest";

/**
 * `apps/dash` imports the oRPC router to build its in-process RSC client, and has no
 * Resend configuration of its own. Importing the router therefore must not construct
 * that client.
 *
 * This guards the class of regression where an integration constructs its client at
 * module scope and throws during dash's instrumentation hook — a failure that survives
 * env validation when the credentials are declared optional. (The original case was
 * Algolia, since removed.)
 */
describe("oRPC router import", () => {
  it("does not construct the Resend client", async () => {
    vi.resetModules();
    // Unrelated integrations (S3, Spotify) validate their own env at import; this test
    // is only about clients that are built lazily.
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    vi.stubEnv("RESEND_API_KEY", "");

    const { router } = await import("../orpc/router");

    expect(Object.keys(router)).toEqual(
      expect.arrayContaining(["content", "email", "toolings", "media"])
    );

    vi.unstubAllEnvs();
  });
});
