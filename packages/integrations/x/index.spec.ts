import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTweet } from ".";

const { fetchTweetMock } = vi.hoisted(() => ({ fetchTweetMock: vi.fn() }));

vi.mock("react-tweet/api", () => ({ fetchTweet: fetchTweetMock }));

describe("getTweet", () => {
  beforeEach(() => {
    fetchTweetMock.mockReset();
  });

  it("returns the post when X has it", async () => {
    const tweet = { id_str: "1" };
    fetchTweetMock.mockResolvedValue({ data: tweet });

    await expect(getTweet("1")).resolves.toEqual({ status: "found", tweet });
    expect(fetchTweetMock).toHaveBeenCalledWith(
      "1",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("reports a private post", async () => {
    fetchTweetMock.mockResolvedValue({ tombstone: true });

    await expect(getTweet("1")).resolves.toEqual({
      status: "unavailable",
      reason: "private",
    });
  });

  it("reports a missing post", async () => {
    fetchTweetMock.mockResolvedValue({ notFound: true });

    await expect(getTweet("1")).resolves.toEqual({
      status: "unavailable",
      reason: "not-found",
    });
  });

  it("lets upstream failures throw", async () => {
    fetchTweetMock.mockRejectedValue(new Error("rate limited"));

    await expect(getTweet("1")).rejects.toThrow("rate limited");
  });
});
