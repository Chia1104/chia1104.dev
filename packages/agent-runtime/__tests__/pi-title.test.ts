import type { AssistantMessage, Context, Models } from "@earendil-works/pi-ai";
import { describe, expect, it, vi } from "vitest";

import { HOUSE_MODELS } from "@chia/ai/house-models";

import { AGENT_PROVIDERS, createAgentModels } from "../src/models.ts";
import {
  SESSION_TITLE_MAX_LENGTH,
  fallbackSessionTitle,
  generateSessionTitle,
  normalizeSessionTitle,
} from "../src/pi/title.ts";

/**
 * The title generator's contract is "a short line or nothing, never a throw". The model is
 * stubbed: what is pinned is the shaping of its reply and that every failure mode collapses to
 * `null` for the caller's fallback.
 */

const reply = (
  text: string,
  stopReason: AssistantMessage["stopReason"] = "stop"
): AssistantMessage => ({
  role: "assistant",
  content: [{ type: "text", text }],
  api: "anthropic-messages",
  provider: "vercel-ai-gateway",
  model: HOUSE_MODELS.cheap,
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  stopReason,
  timestamp: 0,
});

const modelsWith = (
  completeSimple: (
    model: Parameters<Models["completeSimple"]>[0],
    context: Context
  ) => Promise<AssistantMessage>
): Pick<Models, "completeSimple"> => ({ completeSimple });

/** A real catalogue entry; the stub never calls it, the generator only passes it through. */
const model = createAgentModels().getModel(
  AGENT_PROVIDERS.gateway,
  HOUSE_MODELS.cheap
)!;

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
    const long = "word ".repeat(40);
    const title = normalizeSessionTitle(long);
    expect(title).not.toBeNull();
    expect([...title!].length).toBeLessThanOrEqual(SESSION_TITLE_MAX_LENGTH);
    expect(title!.endsWith("…")).toBe(true);
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
    const aborted = {
      ...reply("x", "aborted"),
      usage: { ...reply("x").usage, input: 40, output: 3, totalTokens: 43 },
    };

    const title = await generateSessionTitle({
      models: modelsWith(() => Promise.resolve(aborted)),
      model,
      text: "hi",
      onUsage,
    });

    expect(title).toBeNull();
    expect(onUsage).toHaveBeenCalledExactlyOnceWith({
      providerId: "vercel-ai-gateway",
      modelId: HOUSE_MODELS.cheap,
      usage: aborted.usage,
    });
  });

  it("returns the model's reply normalised", async () => {
    const title = await generateSessionTitle({
      models: modelsWith(() =>
        Promise.resolve(reply('"Plan the Drizzle migration"\n'))
      ),
      model,
      text: "Can you help me plan the migration to Drizzle 1.0?",
    });
    expect(title).toBe("Plan the Drizzle migration");
  });

  it("sends the prompt as quoted data inside the user turn", async () => {
    let seen: Context | undefined;
    const models = modelsWith((_model, context) => {
      seen = context;
      return Promise.resolve(reply("Title"));
    });
    await generateSessionTitle({ models, model, text: "  hello  " });
    expect(seen).toMatchObject({
      messages: [{ role: "user", content: "<message>\nhello\n</message>" }],
    });
  });

  it("collapses every failure to null: empty prompt, provider error, abort, throw, empty reply", async () => {
    expect(
      await generateSessionTitle({
        models: modelsWith(() => Promise.resolve(reply("x"))),
        model,
        text: "   ",
      })
    ).toBeNull();
    expect(
      await generateSessionTitle({
        models: modelsWith(() => Promise.resolve(reply("x", "error"))),
        model,
        text: "hi",
      })
    ).toBeNull();
    expect(
      await generateSessionTitle({
        models: modelsWith(() => Promise.resolve(reply("x", "aborted"))),
        model,
        text: "hi",
      })
    ).toBeNull();
    expect(
      await generateSessionTitle({
        models: modelsWith(() => Promise.reject(new Error("boom"))),
        model,
        text: "hi",
      })
    ).toBeNull();
    expect(
      await generateSessionTitle({
        models: modelsWith(() => Promise.resolve(reply("   "))),
        model,
        text: "hi",
      })
    ).toBeNull();
  });
});
