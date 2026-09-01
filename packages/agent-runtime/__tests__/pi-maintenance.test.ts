import { createModels } from "@earendil-works/pi-ai";
import type { Context } from "@earendil-works/pi-ai";
import {
  fauxAssistantMessage,
  fauxProvider,
} from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "vitest";

import { compactPiSession, navigatePiSession } from "../src/pi/maintenance.ts";
import type { PiSessionOperationOptions } from "../src/pi/maintenance.ts";
import type { NewSessionEntry } from "../src/session/entries.ts";
import { InMemorySessionTree } from "../src/session/tree.ts";
import type { AgentUsageReport } from "../src/types.ts";

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
  message: fauxAssistantMessage(text, { timestamp: 2 }),
});

const build = async () => {
  const faux = fauxProvider({
    provider: "faux",
    models: [{ id: "test-model", contextWindow: 100_000 }],
  });
  const models = createModels();
  models.setProvider(faux.provider);
  const session = new InMemorySessionTree("session-1");
  for (const entry of [
    user("u1", null, "First question"),
    assistant("a1", "u1", "First answer"),
    user("u2", "a1", "Second question"),
    assistant("a2", "u2", "Second answer"),
  ]) {
    await session.appendEntry(entry);
  }
  const options: PiSessionOperationOptions = {
    session,
    models,
    model: faux.getModel(),
    settings: {
      providerId: "faux",
      modelId: "test-model",
      thinkingLevel: "off",
      activeToolNames: null,
      autoApprove: [],
    },
  };
  return { faux, session, options };
};

/**
 * Pi keeps the newest ~20k tokens whole and summarises what lies before them, so a compaction
 * only has work once the tail alone crosses that: one oversized prompt after the seeded turns
 * pushes those turns into the summarised part.
 */
const growPastRetainedTail = async (session: InMemorySessionTree) => {
  await session.appendEntry(user("u3", "a2", "x".repeat(100_000)));
  await session.appendEntry(assistant("a3", "u3", "Noted."));
};

/**
 * The faux provider estimates usage from the text it streams, so what is pinned is that the
 * report carries exactly the usage the tree persisted, under that entry's id.
 */
describe("usage reporting", () => {
  it("reports the branch summary's usage under its entry", async () => {
    const { faux, session, options } = await build();
    const reports: AgentUsageReport[] = [];
    faux.setResponses([fauxAssistantMessage("They asked twice.")]);

    await navigatePiSession(
      { ...options, onUsage: (report) => void reports.push(report) },
      "u2",
      { summarize: true }
    );

    const summary = (await session.getBranch()).at(-1);
    expect(summary?.type).toBe("branch_summary");
    expect(reports).toEqual([
      {
        source: "branch_summary",
        providerId: "faux",
        modelId: "test-model",
        entryId: summary?.id,
        usage: summary?.type === "branch_summary" ? summary.usage : undefined,
      },
    ]);
    expect(reports[0]?.usage.totalTokens).toBeGreaterThan(0);
  });

  it("reports a manual compaction's usage under its entry", async () => {
    const { faux, session, options } = await build();
    await growPastRetainedTail(session);
    const reports: AgentUsageReport[] = [];
    faux.setResponses([fauxAssistantMessage("Condensed.")]);

    await compactPiSession({
      ...options,
      onUsage: (report) => void reports.push(report),
    });

    const compaction = (await session.getBranch()).at(-1);
    expect(compaction?.type).toBe("compaction");
    expect(reports).toEqual([
      {
        source: "compaction",
        providerId: "faux",
        modelId: "test-model",
        entryId: compaction?.id,
        usage: compaction?.type === "compaction" ? compaction.usage : undefined,
      },
    ]);
    expect(reports[0]?.usage.totalTokens).toBeGreaterThan(0);
  });
});

describe("navigatePiSession", () => {
  it("rewinds to a user message by making its parent the leaf", async () => {
    const { session, options } = await build();

    const result = await navigatePiSession(options, "u2", {});

    expect(result).toEqual({ cancelled: false });
    await expect(session.getLeafId()).resolves.toBe("a1");
    expect((await session.getBranch()).map((e) => e.id)).toEqual(["u1", "a1"]);
  });

  it("rewinds to an assistant message by making it the leaf", async () => {
    const { session, options } = await build();

    await navigatePiSession(options, "a1", {});

    await expect(session.getLeafId()).resolves.toBe("a1");
  });

  it("is a no-op when already at the target", async () => {
    const { session, options } = await build();

    await navigatePiSession(options, "a2", {});

    await expect(session.getLeafId()).resolves.toBe("a2");
    expect(await session.getEntries()).toHaveLength(4);
  });

  it("labels the target without moving the leaf onto the label", async () => {
    const { session, options } = await build();

    await navigatePiSession(options, "u2", { label: "before the tangent" });

    await expect(session.getLeafId()).resolves.toBe("a1");
    await expect(session.getLabel("u2")).resolves.toBe("before the tangent");
    expect((await session.getBranch()).some((e) => e.type === "label")).toBe(
      false
    );
  });

  it("summarises the branch left behind under the new leaf", async () => {
    const { faux, session, options } = await build();
    faux.setResponses([fauxAssistantMessage("They asked twice.")]);

    await navigatePiSession(options, "u2", { summarize: true });

    const branch = await session.getBranch();
    const summary = branch.at(-1);
    expect(summary).toMatchObject({
      type: "branch_summary",
      parentId: "a1",
      // Pi frames the generated text as a branch that was explored and left.
      summary: expect.stringContaining("They asked twice."),
    });
    await expect(session.getLeafId()).resolves.toBe(summary?.id);
    expect(faux.getPendingResponseCount()).toBe(0);
  });

  it("persists nothing when cancelled after the summary was generated", async () => {
    const { faux, session, options } = await build();
    const controller = new AbortController();
    faux.setResponses([
      () => {
        // The caller cancels while the summary request is in flight.
        controller.abort();
        return fauxAssistantMessage("Too late.");
      },
    ]);

    const result = await navigatePiSession(
      { ...options, signal: controller.signal },
      "u2",
      { summarize: true, label: "never written" }
    );

    expect(result).toEqual({ cancelled: true });
    await expect(session.getLeafId()).resolves.toBe("a2");
    expect(await session.getEntries()).toHaveLength(4);
  });

  it("finds the common ancestor across a compaction so shared history is not summarised", async () => {
    const { faux, session, options } = await build();
    // u1 → a1 → c1 (compaction) → u3 → a3, then rewind to u1 with a summary.
    await navigatePiSession(options, "a1", {});
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
    const seen: Context[] = [];
    faux.setResponses([
      (context) => {
        seen.push(context);
        return fauxAssistantMessage("They went past the compaction.");
      },
    ]);

    await navigatePiSession(options, "u1", { summarize: true });

    const summarised = JSON.stringify(seen[0]?.messages);
    expect(summarised).toContain("Third answer");
    expect(summarised).toContain("The first exchange, condensed.");
    // u1 is the target's own entry, an ancestor of both paths, and must not be summarised.
    expect(summarised).not.toContain("First question");
    const leaf = (await session.getBranch()).at(-1);
    expect(leaf).toMatchObject({
      type: "branch_summary",
      parentId: null,
      fromId: "root",
    });
  });

  it("rejects an unknown target", async () => {
    const { options } = await build();

    await expect(navigatePiSession(options, "nope", {})).rejects.toThrow(
      "Entry nope not found"
    );
  });
});

describe("compactPiSession", () => {
  it("appends a compaction entry as the new leaf", async () => {
    const { faux, session, options } = await build();
    await growPastRetainedTail(session);
    faux.setResponses([fauxAssistantMessage("Two questions, two answers.")]);

    const result = await compactPiSession(options);

    expect(result).toMatchObject({ summary: "Two questions, two answers." });
    const leaf = (await session.getBranch()).at(-1);
    expect(leaf).toMatchObject({
      type: "compaction",
      summary: "Two questions, two answers.",
      retainedTail: expect.any(Array),
    });
    await expect(session.getLeafId()).resolves.toBe(leaf?.id);
  });

  it("answers null for an empty session", async () => {
    const { options } = await build();
    const empty = new InMemorySessionTree("empty");

    await expect(
      compactPiSession({ ...options, session: empty })
    ).resolves.toBeNull();
  });

  it("persists nothing when cancelled while the summary is generating", async () => {
    const { faux, session, options } = await build();
    await growPastRetainedTail(session);
    const controller = new AbortController();
    faux.setResponses([
      () => {
        controller.abort();
        return fauxAssistantMessage("Too late.");
      },
    ]);

    await expect(
      compactPiSession({ ...options, signal: controller.signal })
    ).rejects.toMatchObject({ code: "aborted" });

    await expect(session.getLeafId()).resolves.toBe("a3");
    expect(await session.getEntries()).toHaveLength(6);
  });

  it("answers null without calling the model when the branch fits in the retained tail", async () => {
    const { faux, session, options } = await build();
    faux.setResponses([fauxAssistantMessage("Never asked for.")]);
    const before = await session.getLeafId();

    await expect(compactPiSession(options)).resolves.toBeNull();

    await expect(session.getLeafId()).resolves.toBe(before);
    expect(faux.getPendingResponseCount()).toBe(1);
  });
});
