import { describe, expect, it, vi } from "vitest";

import type { AgentKindDefinition } from "@chia/agent-host/kind";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import { createAgentFactory } from "../orpc/services/agent.factory";

const definitionOf = (kind: string, minTier: CallerTier = CallerTier.Root) =>
  /* SAFETY: factory resolution only reads the discriminator and tier floor in these tests. */ ({
    kind,
    minTier,
  }) as AgentKindDefinition<unknown, object>;

const credentials = {
  read: () => undefined,
  decrypt: () => ({}),
};
const runs = {
  get: vi.fn(),
  hasHook: vi.fn(),
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
