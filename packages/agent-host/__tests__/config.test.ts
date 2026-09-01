import { describe, expect, it, vi } from "vitest";
import * as z from "zod";

import type { AgentKindConfig } from "@chia/db/schema";

import { effectiveKindConfig, effectiveKindDefaults } from "../src/config";

/**
 * Effective config is the row over the definition. The model pair is all-or-nothing;
 * other fields fall through; a schema-rejected row is ignored, not half-applied.
 */

const definition = {
  kind: "writing",
  defaults: {
    providerId: "vercel-ai-gateway",
    modelId: "anthropic/claude-sonnet-5",
    thinkingLevel: "off" as const,
  },
  config: {
    schema: z.object({ instructions: z.string().max(20).optional() }),
    defaults: {},
  },
};

const row = (overrides: Partial<AgentKindConfig> = {}): AgentKindConfig => ({
  kind: "writing",
  providerId: null,
  modelId: null,
  thinkingLevel: null,
  autoApprove: null,
  config: {},
  updatedAt: new Date("2026-08-27T00:00:00Z"),
  ...overrides,
});

describe("effectiveKindDefaults", () => {
  it("is the code's values without a row", () => {
    expect(effectiveKindDefaults(definition, undefined)).toEqual({
      providerId: "vercel-ai-gateway",
      modelId: "anthropic/claude-sonnet-5",
      thinkingLevel: "off",
      autoApprove: undefined,
    });
  });

  it("takes each override on its own and the model pair only whole", () => {
    expect(
      effectiveKindDefaults(
        definition,
        row({ thinkingLevel: "high", autoApprove: ["draft"] })
      )
    ).toMatchObject({
      modelId: "anthropic/claude-sonnet-5",
      thinkingLevel: "high",
      autoApprove: ["draft"],
    });
    expect(
      effectiveKindDefaults(
        definition,
        row({ providerId: "vercel-ai-gateway", modelId: "openai/gpt-5.4" })
      )
    ).toMatchObject({ modelId: "openai/gpt-5.4", thinkingLevel: "off" });
    // Half a pair is no pair: the write sets both or neither, and a read never mixes them.
    expect(
      effectiveKindDefaults(definition, row({ modelId: "openai/gpt-5.4" }))
    ).toMatchObject({ modelId: "anthropic/claude-sonnet-5" });
  });
});

describe("effectiveKindConfig", () => {
  it("merges the row over the defaults when the schema accepts it", () => {
    expect(
      effectiveKindConfig(
        definition,
        row({ config: { instructions: "Short intros." } })
      )
    ).toEqual({ instructions: "Short intros." });
  });

  it("ignores a row the current schema rejects", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(
      effectiveKindConfig(
        definition,
        row({ config: { instructions: "x".repeat(21) } })
      )
    ).toEqual({});
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
