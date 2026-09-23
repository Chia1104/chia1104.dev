const { workflowControl } = vi.hoisted(() => ({
  workflowControl: {
    startFeedSummary: vi.fn(),
    getRun: vi.fn(),
  },
}));

vi.mock("../src/repos/workflow-control.repo", () => ({ workflowControl }));

import { safe } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CallerTier } from "@chia/auth/tier";
import * as dbMocks from "@chia/test/mocks/db-feeds";

import * as guardMocks from "./helpers/guards";
import { client, errorCode } from "./helpers/rpc";

/** The summary is the workflow's to write; the route only admits a published post and hands over. */
describe("feeds.summarize", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
    dbMocks.resetAllDbMocks();
    workflowControl.startFeedSummary.mockReset();
    workflowControl.getRun.mockReset();
    guardMocks.setCallerTier(CallerTier.Root);
  });

  it("starts the summarize workflow on a published post", async () => {
    workflowControl.startFeedSummary.mockResolvedValue("wrun_summary");

    await expect(client.feeds.summarize({ feedId: 1 })).resolves.toEqual({
      runId: "wrun_summary",
    });
    expect(workflowControl.startFeedSummary).toHaveBeenCalledWith(1);
  });

  it("refuses an unpublished post", async () => {
    dbMocks.getFeedForIndexing.mockResolvedValueOnce({
      ...dbMocks.mockFeeds[0],
      published: false,
    });

    const { error } = await safe(client.feeds.summarize({ feedId: 1 }));

    expect(errorCode(error)).toBe("BAD_REQUEST");
    expect(workflowControl.startFeedSummary).not.toHaveBeenCalled();
  });

  it("treats a deleted post as missing", async () => {
    dbMocks.getFeedForIndexing.mockResolvedValueOnce({
      ...dbMocks.mockFeeds[0],
      deletedAt: new Date("2026-01-01"),
    });

    const { error } = await safe(client.feeds.summarize({ feedId: 1 }));

    expect(errorCode(error)).toBe("NOT_FOUND");
  });

  it("is the operator's alone", async () => {
    guardMocks.setCallerTier(CallerTier.Session);

    const { error } = await safe(client.feeds.summarize({ feedId: 1 }));

    expect(errorCode(error)).toBe("FORBIDDEN");
    expect(workflowControl.startFeedSummary).not.toHaveBeenCalled();
  });

  it("reads the run back with its output once it completed", async () => {
    workflowControl.getRun.mockResolvedValue({
      type: "run",
      exists: true,
      status: "completed",
      output: {
        success: true,
        translations: [{ locale: "en", status: "ok" }],
      },
    });

    await expect(
      client.feeds["summarize:run"]({ runId: "wrun_summary" })
    ).resolves.toEqual({
      status: "completed",
      output: {
        success: true,
        translations: [{ locale: "en", status: "ok" }],
      },
    });
  });

  it("drops an output of another shape rather than failing the read", async () => {
    workflowControl.getRun.mockResolvedValue({
      type: "run",
      exists: true,
      status: "completed",
      output: { deletedCount: 3 },
    });

    await expect(
      client.feeds["summarize:run"]({ runId: "wrun_other" })
    ).resolves.toEqual({ status: "completed", output: undefined });
  });

  it("answers NOT_FOUND for a run the World no longer has", async () => {
    workflowControl.getRun.mockResolvedValue({ type: "run", exists: false });

    const { error } = await safe(
      client.feeds["summarize:run"]({ runId: "wrun_gone" })
    );

    expect(errorCode(error)).toBe("NOT_FOUND");
  });
});
