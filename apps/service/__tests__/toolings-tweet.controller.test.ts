import { safe } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CallerTier } from "@chia/auth/tier";

import * as guardMocks from "./helpers/guards";
import { client, errorCode } from "./helpers/rpc";

const { getTweetMock } = vi.hoisted(() => ({ getTweetMock: vi.fn() }));

vi.mock("@chia/integrations/x", () => ({ getTweet: getTweetMock }));

// Every case uses its own id so the KV cache never carries a result across cases.
const uniqueId = () => String(Date.now() + Math.floor(Math.random() * 1e6));

describe("toolings.tweet", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
    guardMocks.setCallerTier(CallerTier.ApiKey);
    getTweetMock.mockReset();
  });

  it("requires an API key", async () => {
    guardMocks.setCallerTier(CallerTier.Anonymous);

    const { error } = await safe(client.toolings.tweet({ id: uniqueId() }));

    expect(errorCode(error)).toBe("UNAUTHORIZED");
    expect(getTweetMock).not.toHaveBeenCalled();
  });

  it("returns the post and serves the next read from cache", async () => {
    const id = uniqueId();
    const result = { status: "found", tweet: { id_str: id } };
    getTweetMock.mockResolvedValue(result);

    await expect(client.toolings.tweet({ id })).resolves.toEqual(result);
    await expect(client.toolings.tweet({ id })).resolves.toEqual(result);
    expect(getTweetMock).toHaveBeenCalledTimes(1);
  });

  it("returns an unavailable post as a result", async () => {
    const result = { status: "unavailable", reason: "not-found" };
    getTweetMock.mockResolvedValue(result);

    await expect(client.toolings.tweet({ id: uniqueId() })).resolves.toEqual(
      result
    );
  });

  it("reports an upstream failure with nothing cached", async () => {
    getTweetMock.mockRejectedValue(new Error("rate limited"));

    const { error } = await safe(client.toolings.tweet({ id: uniqueId() }));

    expect(errorCode(error)).toBe("SERVICE_UNAVAILABLE");
  });

  it("rejects an id that is not numeric", async () => {
    const { error } = await safe(client.toolings.tweet({ id: "abc" }));

    expect(errorCode(error)).toBe("BAD_REQUEST");
    expect(getTweetMock).not.toHaveBeenCalled();
  });
});
