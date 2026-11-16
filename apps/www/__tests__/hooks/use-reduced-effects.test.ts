import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useReducedEffects } from "@/hooks/use-reduced-effects";
import { useSettingsStore } from "@/stores/settings/store";

const stubHover = (canHover: boolean) => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: canHover,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

describe("useReducedEffects", () => {
  beforeEach(() => {
    useSettingsStore.setState({ reducedEffects: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is off by default where the pointer hovers", () => {
    stubHover(true);
    expect(renderHook(() => useReducedEffects()).result.current).toBe(false);
  });

  it("is on by default on a touch device", () => {
    stubHover(false);
    expect(renderHook(() => useReducedEffects()).result.current).toBe(true);
  });

  it.each([
    [true, true],
    [false, false],
  ])("the reader's choice of %s wins on either device", (choice, expected) => {
    useSettingsStore.getState().setReducedEffects(choice);
    for (const canHover of [true, false]) {
      stubHover(canHover);
      expect(renderHook(() => useReducedEffects()).result.current).toBe(
        expected
      );
    }
  });
});
