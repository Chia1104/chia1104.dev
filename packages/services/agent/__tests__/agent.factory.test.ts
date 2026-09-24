import { describe, expect, it, vi } from "vitest";
import * as z from "zod";

import type { AgentKindDefinition } from "@chia/agent-host/kind";
import { CallerTier } from "@chia/auth/tier";

import { createAgentFactory } from "../agent.factory";

/** Factory resolution reads only the discriminator and the tier floor. */
const definitionOf = (
  kind: string,
  minTier: CallerTier = CallerTier.Root
): AgentKindDefinition<unknown, object> => ({
  kind,
  label: kind,
  description: "",
  minTier,
  defaults: { providerId: "house", modelId: "house-model" },
  policy: { toolInfo: vi.fn(), requiresApproval: vi.fn(), summarize: vi.fn() },
  models: { assert: vi.fn(), list: vi.fn(), resolve: vi.fn() },
  config: { schema: z.object({}), defaults: {} },
  capabilities: vi.fn(),
  state: { create: vi.fn(), load: vi.fn(), fork: vi.fn(), detail: vi.fn() },
});

const credentials = {
  read: () => undefined,
  decrypt: () => ({}),
};
const runs = {
  get: vi.fn(),
};

const factoryOf = (
  load: () => Promise<AgentKindDefinition<unknown, object>>,
  minTier: CallerTier = CallerTier.Root
) =>
  createAgentFactory({
    kinds: { writing: { minTier, load } },
    credentials,
    runs,
  });

describe("createAgentFactory", () => {
  it("delegates each resolution to the host loader without storing definitions", async () => {
    const load = vi.fn(() => Promise.resolve(definitionOf("writing")));
    const factory = factoryOf(load);

    await expect(factory.load("writing")).resolves.toMatchObject({
      kind: "writing",
    });
    await expect(factory.load("writing")).resolves.toMatchObject({
      kind: "writing",
    });

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("answers the registered tier floor without invoking the host loader", () => {
    const load = vi.fn(() => Promise.resolve(definitionOf("writing")));
    const factory = factoryOf(load);

    expect(factory.minTierOf("writing")).toBe(CallerTier.Root);
    expect(factory.minTierOf("missing")).toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });

  it("rejects unknown ids before invoking the host loader", async () => {
    const load = vi.fn(() => Promise.resolve(definitionOf("writing")));
    const factory = factoryOf(load);

    await expect(factory.load("constructor")).resolves.toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });

  it("refuses a host definition whose discriminator drifted", async () => {
    const factory = factoryOf(() => Promise.resolve(definitionOf("public")));

    await expect(factory.load("writing")).rejects.toThrow(
      'Agent kind "writing" loaded a definition for "public".'
    );
  });

  it("refuses a definition whose minTier drifted from its registration", async () => {
    const factory = factoryOf(() =>
      Promise.resolve(definitionOf("writing", CallerTier.Guest))
    );

    await expect(factory.load("writing")).rejects.toThrow(
      'Agent kind "writing" is registered with a different minTier than its definition.'
    );
  });
});
