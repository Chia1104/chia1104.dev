import { describe, expect, it, vi } from "vitest";

import { bindingOf, scriptedAdapter } from "../src/testing.ts";
import type { ScriptedReply } from "../src/testing.ts";
import {
  fallbackSessionTitle,
  generateSessionTitle,
  normalizeSessionTitle,
  SESSION_TITLE_MAX_LENGTH,
  SESSION_TITLE_SYSTEM_PROMPT,
} from "../src/title.ts";

/**
 * The title generator's contract is "a short line or nothing, never a throw". The model is
 * scripted: what is pinned is the shaping of its reply and that every failure mode collapses to
 * `null` for the caller's fallback.
 */

const titleFrom = (replies: readonly ScriptedReply[], text = "hi") => {
  const script = scriptedAdapter(replies);
  return {
    script,
    title: generateSessionTitle({ binding: bindingOf(script), text }),
  };
};

describe("normalizeSessionTitle", () => {
  it("keeps the first non-empty line and strips quotes, prefixes and trailing punctuation", () => {
    expect(
      normalizeSessionTitle('\n  Title: "Draft a post about oRPC."  \n')
    ).toBe("Draft a post about oRPC");
    expect(normalizeSessionTitle("「幫我寫一篇關於 Nitro 的文章」。")).toBe(
      "幫我寫一篇關於 Nitro 的文章"
    );
  });

  it("drops a leading list marker, so a model that answered with a list still yields a title", () => {
    expect(
      normalizeSessionTitle("1. Nitro 部署到 Railway 指南\n2. 第二個")
    ).toBe("Nitro 部署到 Railway 指南");
    expect(normalizeSessionTitle("- Plan the migration")).toBe(
      "Plan the migration"
    );
  });

  it("collapses whitespace and clips long titles with an ellipsis", () => {
    const title = normalizeSessionTitle("word ".repeat(40)) ?? "";
    expect([...title].length).toBeLessThanOrEqual(SESSION_TITLE_MAX_LENGTH);
    expect(title.endsWith("…")).toBe(true);
    expect(normalizeSessionTitle("a   b\t c")).toBe("a b c");
  });

  it("returns null for nothing usable", () => {
    expect(normalizeSessionTitle("")).toBeNull();
    expect(normalizeSessionTitle("  \n\n ")).toBeNull();
    expect(normalizeSessionTitle('"..."')).toBeNull();
  });
});

describe("fallbackSessionTitle", () => {
  it("is the prompt's first line, shaped like a title", () => {
    expect(
      fallbackSessionTitle("Rewrite the intro paragraph.\n\nHere is the draft…")
    ).toBe("Rewrite the intro paragraph");
  });
});

describe("generateSessionTitle", () => {
  it("reports what the call was billed even when the reply is unusable", async () => {
    const onUsage = vi.fn();
    const script = scriptedAdapter([
      {
        text: "   ",
        usage: { promptTokens: 40, completionTokens: 3, totalTokens: 43 },
      },
    ]);

    const title = await generateSessionTitle({
      binding: bindingOf(script),
      text: "hi",
      onUsage,
    });

    expect(title).toBeNull();
    expect(onUsage).toHaveBeenCalledExactlyOnceWith({
      providerId: "scripted",
      modelId: "test-model",
      usage: expect.objectContaining({ input: 40, output: 3, totalTokens: 43 }),
    });
  });

  it("returns the model's reply normalised", async () => {
    const { title } = titleFrom(
      [{ text: '"Plan the Drizzle migration"\n' }],
      "Can you help me plan the migration to Drizzle 1.0?"
    );
    await expect(title).resolves.toBe("Plan the Drizzle migration");
  });

  it("sends the prompt as quoted data inside the user turn, under the title instructions", async () => {
    const { script, title } = titleFrom([{ text: "Title" }], "  hello  ");
    await title;

    expect(script.requests[0]).toMatchObject({
      messages: [{ role: "user", content: "<message>\nhello\n</message>" }],
      systemPrompts: [SESSION_TITLE_SYSTEM_PROMPT],
      // One short line: the sampling leaves no room to elaborate.
      modelOptions: { temperature: 0.2, max_output_tokens: 64 },
    });
  });

  it("sends the operator's system prompt in place of the default", async () => {
    const script = scriptedAdapter([{ text: "Title" }]);

    await generateSessionTitle({
      binding: bindingOf(script),
      text: "hello",
      systemPrompt: "Name it in three words.",
    });

    expect(script.requests[0]?.systemPrompts).toEqual([
      "Name it in three words.",
    ]);
  });

  it("collapses every failure to null: empty prompt, provider error, abort, throw, empty reply", async () => {
    const empty = titleFrom([{ text: "x" }], "   ");
    await expect(empty.title).resolves.toBeNull();
    // An empty prompt never reaches the model.
    expect(empty.script.requests).toHaveLength(0);

    await expect(
      titleFrom([{ error: "503 overloaded" }]).title
    ).resolves.toBeNull();

    const controller = new AbortController();
    const script = scriptedAdapter([
      { text: "x", hang: true, onRequest: () => controller.abort() },
    ]);
    await expect(
      generateSessionTitle({
        binding: bindingOf(script),
        text: "hi",
        signal: controller.signal,
      })
    ).resolves.toBeNull();

    // No reply scripted: the adapter throws instead of streaming.
    await expect(titleFrom([]).title).resolves.toBeNull();

    await expect(titleFrom([{ text: "   " }]).title).resolves.toBeNull();
  });
});
