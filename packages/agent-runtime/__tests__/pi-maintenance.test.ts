import { createModels } from "@earendil-works/pi-ai";
import type { Context } from "@earendil-works/pi-ai";
import {
  fauxAssistantMessage,
  fauxProvider,
} from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "vitest";

import { compactPiSession, navigatePiSession } from "../src/pi/maintenance.ts";
import type { PiSessionOperationOptions } from "../src/pi/maintenance.ts";
import type { SessionEntry } from "../src/session/entries.ts";
import { InMemorySessionTree } from "../src/session/tree.ts";

const user = (
  id: string,
  parentId: string | null,
  text: string
): SessionEntry => ({
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
): SessionEntry => ({
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
    // u1 is the target's own entry — an ancestor of both paths — and must not be summarised.
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

  it("refuses an empty session", async () => {
    const { options } = await build();
    const empty = new InMemorySessionTree("empty");

    await expect(
      compactPiSession({ ...options, session: empty })
    ).rejects.toThrow("Nothing to compact");
  });
});
