import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "vitest";

import {
  assistantUsageOf,
  build,
  seedOversizedBranch,
  toolCallTurn,
} from "./runtime.fixture.ts";

describe("runPiTurn compaction", () => {
  it("does not compact a successful turn that requests approval", async () => {
    const fixture = build();
    await seedOversizedBranch(fixture.session);
    fixture.faux.setResponses([
      toolCallTurn("publish", {}, "call-1"),
      fauxAssistantMessage("Waiting."),
    ]);

    await expect(fixture.run()).resolves.toMatchObject({
      status: "awaiting_approval",
    });
    expect((await fixture.branch()).some((e) => e.type === "compaction")).toBe(
      false
    );
  });

  it("compacts a successful, approval-free turn under context pressure and announces it", async () => {
    const fixture = build();
    await seedOversizedBranch(fixture.session);
    fixture.faux.setResponses([
      fauxAssistantMessage("Sure."),
      // Consumed by compaction's summary request.
      fauxAssistantMessage("Everything so far, condensed."),
    ]);

    const result = await fixture.run();

    expect(result.status).toBe("done");
    const branch = await fixture.branch();
    const compaction = branch.find((entry) => entry.type === "compaction");
    expect(compaction).toMatchObject({
      summary: "Everything so far, condensed.",
      retainedTail: expect.any(Array),
    });
    // The compaction is the new leaf, so the next turn starts from the summary.
    await expect(fixture.session.getLeafId()).resolves.toBe(compaction?.id);
    expect(fixture.events.slice(-2)).toEqual([
      expect.objectContaining({
        type: "session:compacted",
        summary: "Everything so far, condensed.",
      }),
      { type: "run:end", reason: "done" },
    ]);
  });

  it("reports every assistant reply's usage once its entry has landed", async () => {
    const fixture = build();
    const reports: AgentUsageReport[] = [];
    const branchLengthAtReport: number[] = [];
    fixture.faux.setResponses([
      toolCallTurn("search", { q: "usage" }, "call-1"),
      fauxAssistantMessage("Found it."),
    ]);

    await fixture.run({
      onUsage: async (report) => {
        reports.push(report);
        branchLengthAtReport.push((await fixture.session.getBranch()).length);
      },
    });

    // The faux provider estimates usage from the text it streams, so the figures are whatever
    // the tree persisted for that reply. The report must be exactly those, under that entry's
    // id.
    const branch = await fixture.branch();
    expect(reports).toEqual([
      {
        source: "turn",
        providerId: "faux",
        modelId: "test-model",
        entryId: branch[1]?.id,
        usage: assistantUsageOf(branch[1]),
      },
      {
        source: "turn",
        providerId: "faux",
        modelId: "test-model",
        entryId: branch[3]?.id,
        usage: assistantUsageOf(branch[3]),
      },
    ]);
    expect(reports.every((report) => report.usage.totalTokens > 0)).toBe(true);
    expect(branchLengthAtReport).toEqual([2, 4]);
  });

  it("reports the auto-compaction's usage under the compaction entry", async () => {
    const fixture = build();
    await seedOversizedBranch(fixture.session);
    const reports: AgentUsageReport[] = [];
    fixture.faux.setResponses([
      fauxAssistantMessage("Sure."),
      fauxAssistantMessage("Everything so far, condensed."),
    ]);

    await fixture.run({ onUsage: (report) => void reports.push(report) });

    const compaction = (await fixture.branch()).find(
      (entry) => entry.type === "compaction"
    );
    expect(reports.map((report) => report.source)).toEqual([
      "turn",
      "compaction",
    ]);
    expect(reports[1]).toEqual({
      source: "compaction",
      providerId: "faux",
      modelId: "test-model",
      entryId: compaction?.id,
      usage: compaction?.type === "compaction" ? compaction.usage : undefined,
    });
    expect(reports[1]?.usage.totalTokens).toBeGreaterThan(0);
  });

  it("leaves a branch inside the window alone", async () => {
    const fixture = build();
    fixture.faux.setResponses([fauxAssistantMessage("Small talk.")]);

    await fixture.run();

    expect((await fixture.branch()).some((e) => e.type === "compaction")).toBe(
      false
    );
    expect(fixture.faux.getPendingResponseCount()).toBe(0);
  });

  it("keeps a successful turn successful when compaction fails", async () => {
    const fixture = build();
    await seedOversizedBranch(fixture.session);
    // No response scripted for the summary request: compaction fails, the turn does not.
    fixture.faux.setResponses([fauxAssistantMessage("Sure.")]);

    await expect(fixture.run()).resolves.toEqual({
      status: "done",
      approvals: [],
      error: undefined,
    });
    expect((await fixture.branch()).some((e) => e.type === "compaction")).toBe(
      false
    );
  });
});
