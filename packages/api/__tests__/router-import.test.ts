import { vi } from "vitest";

/**
 * `apps/dash` imports the oRPC router for its in-process RSC client and has no Resend
 * configuration. Importing the router must not construct that client — a module-scope
 * client throws during dash's instrumentation even when the key is optional.
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
      expect.arrayContaining(["feeds", "email", "toolings", "spotify"])
    );

    vi.unstubAllEnvs();
  });
});
