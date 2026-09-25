import { describe, expect, it } from "vitest";

import { AgentUsageSource } from "@chia/db/schema";

import { compactSession } from "../src/compaction.ts";
import { CompletionError } from "../src/complete.ts";
import { navigateSession } from "../src/maintenance.ts";
import type { SessionOperationOptions } from "../src/maintenance.ts";
import type { NewSessionEntry } from "../src/session/entries.ts";
import { InMemorySessionTree } from "../src/session/tree.ts";
import { bindingOf, scriptedAdapter } from "../src/testing.ts";
import type { ScriptedReply } from "../src/testing.ts";
import type { AgentUsageReport } from "../src/types.ts";

import { assistantMessage } from "./runtime.fixture.ts";

const user = (
  id: string,
  parentId: string | null,
  text: string
): NewSessionEntry => ({
  type: "message",
  id,
  parentId,
  timestamp: 1,
  message: { role: "user", content: [{ type: "text", text }], timestamp: 1 },
});

const assistant = (
  id: string,
  parentId: string,
  text: string
): NewSessionEntry => ({
  type: "message",
  id,
  parentId,
  timestamp: 2,
  message: assistantMessage(text, 2),
});

const build = async (replies: readonly ScriptedReply[] = []) => {
  const script = scriptedAdapter(replies);
  const session = new InMemorySessionTree("session-1");
  for (const entry of [
    user("u1", null, "First question"),
    assistant("a1", "u1", "First answer"),
    user("u2", "a1", "Second question"),
    assistant("a2", "u2", "Second answer"),
  ]) {
    await session.appendEntry(entry);
  }
  const options: SessionOperationOptions = {
    session,
    binding: bindingOf(script),
  };
  return { script, session, options };
};

/** The text the summariser was asked to read on request `index`. */
const promptOf = (
  script: ReturnType<typeof scriptedAdapter>,
  index: number
): string => JSON.stringify(script.requests[index]?.messages);

/**
 * The newest ~20k tokens are kept whole and only what lies before them is summarised, so a
 * compaction only has work once the tail alone crosses that: one oversized prompt after the
 * seeded turns pushes those turns into the summarised part.
 */
const growPastRetainedTail = async (session: InMemorySessionTree) => {
  await session.appendEntry(user("u3", "a2", "x".repeat(100_000)));
  await session.appendEntry(assistant("a3", "u3", "Noted."));
};

describe("usage reporting", () => {
  it("reports the branch summary's usage under its entry", async () => {
    const { session, options } = await build([{ text: "They asked twice." }]);
    const reports: AgentUsageReport[] = [];

    await navigateSession(
      { ...options, onUsage: (report) => void reports.push(report) },
      "u2",
      { summarize: true }
    );

    const summary = (await session.getBranch()).at(-1);
    expect(summary?.type).toBe("branch_summary");
    expect(reports).toEqual([
      {
        source: AgentUsageSource.BranchSummary,
        providerId: "scripted",
        modelId: "test-model",
        entryId: summary?.id,
        usage: summary?.type === "branch_summary" ? summary.usage : undefined,
      },
    ]);
    expect(reports[0]?.usage.totalTokens).toBeGreaterThan(0);
  });

  it("reports a manual compaction's usage under its entry", async () => {
    const { session, options } = await build([{ text: "Condensed." }]);
    await growPastRetainedTail(session);
    const reports: AgentUsageReport[] = [];

    await compactSession({
      ...options,
      onUsage: (report) => void reports.push(report),
    });

    const compaction = (await session.getBranch()).at(-1);
    expect(compaction?.type).toBe("compaction");
    expect(reports).toEqual([
      {
        source: AgentUsageSource.Compaction,
        providerId: "scripted",
        modelId: "test-model",
        entryId: compaction?.id,
        usage: compaction?.type === "compaction" ? compaction.usage : undefined,
      },
    ]);
    expect(reports[0]?.usage.totalTokens).toBeGreaterThan(0);
  });
});

describe("navigateSession", () => {
  it("rewinds to a user message by making its parent the leaf", async () => {
    const { session, options } = await build();

    const result = await navigateSession(options, "u2", {});

    expect(result).toEqual({ cancelled: false });
    await expect(session.getLeafId()).resolves.toBe("a1");
    expect((await session.getBranch()).map((e) => e.id)).toEqual(["u1", "a1"]);
  });

  it("rewinds to an assistant message by making it the leaf", async () => {
    const { session, options } = await build();

    await navigateSession(options, "a1", {});

    await expect(session.getLeafId()).resolves.toBe("a1");
  });

  it("is a no-op when already at the target", async () => {
    const { session, options } = await build();

    await navigateSession(options, "a2", {});

    await expect(session.getLeafId()).resolves.toBe("a2");
    expect(await session.getEntries()).toHaveLength(4);
  });

  it("summarises the branch left behind under the new leaf", async () => {
    const { script, session, options } = await build([
      { text: "They asked twice." },
    ]);

    await navigateSession(options, "u2", { summarize: true });

    const branch = await session.getBranch();
    const summary = branch.at(-1);
    expect(summary).toMatchObject({
      type: "branch_summary",
      parentId: "a1",
      fromId: "a1",
      // The generated text is framed as a branch that was explored and left.
      summary: expect.stringContaining("They asked twice."),
    });
    await expect(session.getLeafId()).resolves.toBe(summary?.id);
    expect(script.pending()).toBe(0);
    // Only what the rewind left behind is summarised.
    expect(promptOf(script, 0)).toContain("Second answer");
    expect(promptOf(script, 0)).not.toContain("First answer");
  });

  it("moves the leaf without asking the model when not summarising", async () => {
    const { script, options } = await build([{ text: "Never asked for." }]);

    await navigateSession(options, "u2", {});

    expect(script.requests).toHaveLength(0);
  });

  it("persists nothing when cancelled while the summary is generating", async () => {
    const controller = new AbortController();
    const { session, options } = await build([
      // The caller cancels while the summary request is in flight.
      { text: "Too late.", onRequest: () => controller.abort() },
    ]);

    const result = await navigateSession(
      { ...options, signal: controller.signal },
      "u2",
      { summarize: true }
    );

    expect(result).toEqual({ cancelled: true });
    await expect(session.getLeafId()).resolves.toBe("a2");
    expect(await session.getEntries()).toHaveLength(4);
  });

  it("finds the common ancestor across a compaction so shared history is not summarised", async () => {
    const { script, session, options } = await build([
      { text: "They went past the compaction." },
    ]);
    // u1 → a1 → c1 (compaction) → u3 → a3, then rewind to u1 with a summary.
    await navigateSession(options, "a1", {});
    await session.appendEntry({
      type: "compaction",
      id: "c1",
      parentId: "a1",
      timestamp: 3,
      summary: "The first exchange, condensed.",
      tokensBefore: 10,
      retainedTail: [],
    });
    await session.appendEntry(user("u3", "c1", "Third question"));
    await session.appendEntry(assistant("a3", "u3", "Third answer"));

    await navigateSession(options, "u1", { summarize: true });

    const summarised = promptOf(script, 0);
    expect(summarised).toContain("Third answer");
    expect(summarised).toContain("The first exchange, condensed.");
    // u1 is the target's own entry, an ancestor of both paths, and must not be summarised.
    expect(summarised).not.toContain("First question");
    const leaf = (await session.getBranch()).at(-1);
    expect(leaf).toMatchObject({
      type: "branch_summary",
      parentId: null,
      fromId: null,
    });
  });

  it("rejects an unknown target", async () => {
    const { options } = await build();

    await expect(navigateSession(options, "nope", {})).rejects.toThrow(
      "Entry nope not found"
    );
  });
});

describe("compactSession", () => {
  it("appends a compaction entry as the new leaf", async () => {
    const { script, session, options } = await build([
      { text: "Two questions, two answers." },
    ]);
    await growPastRetainedTail(session);

    const result = await compactSession(options);

    expect(result).toMatchObject({ summary: "Two questions, two answers." });
    const leaf = (await session.getBranch()).at(-1);
    expect(leaf).toMatchObject({
      type: "compaction",
      parentId: "a3",
      summary: "Two questions, two answers.",
      retainedTail: [
        { role: "assistant", content: [{ type: "text", text: "Noted." }] },
      ],
    });
    await expect(session.getLeafId()).resolves.toBe(leaf?.id);
    // The summariser reads the part the tail does not keep.
    expect(promptOf(script, 0)).toContain("Second answer");
    expect(promptOf(script, 0)).not.toContain("Noted.");
  });

  it("folds the previous summary into the next one", async () => {
    const { script, session, options } = await build([
      { text: "First summary." },
      { text: "Second summary." },
    ]);
    await growPastRetainedTail(session);
    await compactSession(options);
    const compaction = await session.getLeafId();
    await session.appendEntry(user("u4", compaction, "y".repeat(100_000)));
    await session.appendEntry(assistant("a4", "u4", "Again."));

    await expect(compactSession(options)).resolves.toMatchObject({
      summary: "Second summary.",
    });
    expect(promptOf(script, 1)).toContain(
      "<previous-summary>\\nFirst summary.\\n</previous-summary>"
    );
  });

  it("answers null for an empty session", async () => {
    const { options } = await build();
    const empty = new InMemorySessionTree("empty");

    await expect(
      compactSession({ ...options, session: empty })
    ).resolves.toBeNull();
  });

  it("persists nothing when cancelled while the summary is generating", async () => {
    const controller = new AbortController();
    const { session, options } = await build([
      { text: "Too late.", onRequest: () => controller.abort() },
    ]);
    await growPastRetainedTail(session);

    const pending = compactSession({ ...options, signal: controller.signal });

    await expect(pending).rejects.toBeInstanceOf(CompletionError);
    await expect(pending).rejects.toMatchObject({ aborted: true });
    await expect(session.getLeafId()).resolves.toBe("a3");
    expect(await session.getEntries()).toHaveLength(6);
  });

  it("fails without persisting when the summariser replies with nothing", async () => {
    const { session, options } = await build([{ text: "   " }]);
    await growPastRetainedTail(session);

    await expect(compactSession(options)).rejects.toThrow(/empty summary/);
    expect(await session.getEntries()).toHaveLength(6);
  });

  it("answers null without calling the model when the branch fits in the retained tail", async () => {
    const { script, session, options } = await build([
      { text: "Never asked for." },
    ]);
    const before = await session.getLeafId();

    await expect(compactSession(options)).resolves.toBeNull();

    await expect(session.getLeafId()).resolves.toBe(before);
    expect(script.requests).toHaveLength(0);
  });
});
