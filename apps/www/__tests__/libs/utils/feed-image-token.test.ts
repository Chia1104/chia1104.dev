import { describe, expect, it, vi } from "vitest";
import {
  createFeedImageToken,
  verifyFeedImageToken,
} from "@/libs/utils/feed-image-token";

vi.mock("@/env", () => ({
  env: {
    SHA_256_HASH: "test-feed-image-secret",
  },
}));

const payload = {
  locale: "en-US",
  type: "posts",
  slug: "signed-feed",
};

describe("feed image token", () => {
  it("verifies a token generated for the same route", () => {
    const token = createFeedImageToken(payload);

    expect(verifyFeedImageToken(payload, token)).toBe(true);
  });

  it("rejects tokens copied to a different route", () => {
    const token = createFeedImageToken(payload);

    expect(
      verifyFeedImageToken({ ...payload, slug: "another-feed" }, token)
    ).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(verifyFeedImageToken(payload, "invalid-token")).toBe(false);
  });
});
