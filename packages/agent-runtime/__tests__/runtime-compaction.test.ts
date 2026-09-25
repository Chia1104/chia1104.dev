const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));

vi.mock("@chia/observability/report", () => ({ reportError }));

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentUsageSource } from "@chia/db/schema";

import type { ScriptedReply } from "../src/testing.ts";
import type { AgentUsageReport } from "../src/types.ts";

import {
  assistantUsageOf,
  build,
  seedOversizedBranch,
  toolCall,
} from "./runtime.fixture.ts";

/**
 * The threshold reads the context the provider reported for the newest reply, so a reply on the
 * seeded branch reports the ~100k tokens it was sent.
 */
const FULL_CONTEXT_USAGE = {
  promptTokens: 100_000,
  completionTokens: 10,
  totalTokens: 100_010,
};

const fullContextReply = (text: string): ScriptedReply => ({
  text,
  usage: FULL_CONTEXT_USAGE,
});

const SUMMARY = "Everything so far, condensed.";

beforeEach(() => {
  reportError.mockClear();
});

describe("runTurn compaction", () => {
  it("does not compact a successful turn that requests approval", async () => {
    const fixture = build([
      { ...toolCall("publish", {}, "call-1"), usage: FULL_CONTEXT_USAGE },
      { text: SUMMARY },
    ]);
    await seedOversizedBranch(fixture.session);

    await expect(fixture.run()).resolves.toMatchObject({
      status: "awaiting_approval",
    });
    expect((await fixture.branch()).some((e) => e.type === "compaction")).toBe(
      false
    );
    expect(fixture.script.pending()).toBe(1);
  });

  it("compacts a successful, approval-free turn under context pressure and announces it", async () => {
    const fixture = build([fullContextReply("Sure."), { text: SUMMARY }]);
    await seedOversizedBranch(fixture.session);

    const result = await fixture.run();

    expect(result).toEqual({ status: "done" });
    const branch = await fixture.branch();
    const compaction = branch.find((entry) => entry.type === "compaction");
    expect(compaction).toMatchObject({
      summary: SUMMARY,
      retainedTail: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: [{ type: "text", text: "Sure." }] },
      ],
    });
    // The compaction is the new leaf, so the next turn starts from the summary.
    await expect(fixture.session.getLeafId()).resolves.toBe(compaction?.id);
    expect(fixture.events.slice(-2)).toEqual([
      expect.objectContaining({ type: "session:compacted", summary: SUMMARY }),
      { type: "run:end", reason: "done" },
    ]);
  });

  it("summarises on the compaction binding when the turn names one", async () => {
    const fixture = build([fullContextReply("Sure.")]);
    await seedOversizedBranch(fixture.session);
    const summariser = build([{ text: SUMMARY }]);

    await fixture.run({ compaction: summariser.options.binding });

    expect(summariser.script.requests).toHaveLength(1);
    expect(fixture.script.requests).toHaveLength(1);
    const compaction = (await fixture.branch()).find(
      (entry) => entry.type === "compaction"
    );
    expect(compaction).toMatchObject({ summary: SUMMARY });
  });

  it("reports every assistant reply's usage once its entry has landed", async () => {
    const fixture = build([
      toolCall("search", { q: "usage" }, "call-1"),
      { text: "Found it." },
    ]);
    const reports: AgentUsageReport[] = [];
    const branchLengthAtReport: number[] = [];

    await fixture.run({
      onUsage: async (report) => {
        reports.push(report);
        branchLengthAtReport.push((await fixture.session.getBranch()).length);
      },
    });

    // The report carries exactly the usage the tree persisted for the reply, under its entry id.
    const branch = await fixture.branch();
    expect(reports).toEqual([
      {
        source: AgentUsageSource.Turn,
        providerId: "scripted",
        modelId: "test-model",
        entryId: branch[1]?.id,
        usage: assistantUsageOf(branch[1]),
      },
      {
        source: AgentUsageSource.Turn,
        providerId: "scripted",
        modelId: "test-model",
        entryId: branch[3]?.id,
        usage: assistantUsageOf(branch[3]),
      },
    ]);
    expect(reports.every((report) => report.usage.totalTokens > 0)).toBe(true);
    expect(branchLengthAtReport).toEqual([2, 4]);
  });

  it("reports the auto-compaction's usage under the compaction entry", async () => {
    const fixture = build([fullContextReply("Sure."), { text: SUMMARY }]);
    await seedOversizedBranch(fixture.session);
    const reports: AgentUsageReport[] = [];

    await fixture.run({ onUsage: (report) => void reports.push(report) });

    const compaction = (await fixture.branch()).find(
      (entry) => entry.type === "compaction"
    );
    expect(reports.map((report) => report.source)).toEqual([
      AgentUsageSource.Turn,
      AgentUsageSource.Compaction,
    ]);
    expect(reports[1]).toEqual({
      source: AgentUsageSource.Compaction,
      providerId: "scripted",
      modelId: "test-model",
      entryId: compaction?.id,
      usage: compaction?.type === "compaction" ? compaction.usage : undefined,
    });
    expect(reports[1]?.usage.totalTokens).toBeGreaterThan(0);
  });

  it("leaves a branch inside the window alone", async () => {
    const fixture = build([{ text: "Small talk." }, { text: SUMMARY }]);

    await fixture.run();

    expect((await fixture.branch()).some((e) => e.type === "compaction")).toBe(
      false
    );
    expect(fixture.script.pending()).toBe(1);
  });

  it("keeps a successful turn successful when compaction fails", async () => {
    // No reply is scripted for the summary request: compaction fails, the turn does not.
    const fixture = build([fullContextReply("Sure.")]);
    await seedOversizedBranch(fixture.session);

    await expect(fixture.run()).resolves.toEqual({ status: "done" });
    expect((await fixture.branch()).some((e) => e.type === "compaction")).toBe(
      false
    );
    expect(fixture.types()).not.toContain("session:compacted");
    expect(reportError).toHaveBeenCalledWith(
      expect.anything(),
      "Session compaction failed",
      expect.objectContaining({ sessionId: "session-1" })
    );
  });
});
