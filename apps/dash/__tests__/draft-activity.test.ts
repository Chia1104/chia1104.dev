import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  draftActivityStore,
  trackDraftToolEvent,
  useDraftActivity,
} from "../src/components/agent/draft-activity";

const start = (
  toolCallId: string,
  tier: string,
  args: { draftId?: number; locale?: string; title?: string },
  label = "Write draft body"
) =>
  ({
    type: "tool:start",
    toolCallId,
    toolName: "write_draft_content",
    label,
    tier,
    args,
  }) as const;

const end = (
  toolCallId: string,
  isError = false,
  aborted?: true,
  details?: { revision: number }
) =>
  ({
    type: "tool:end",
    toolCallId,
    toolName: "write_draft_content",
    isError,
    aborted,
    summary: "",
    details,
  }) as const;

describe("draft activity", () => {
  beforeEach(() => draftActivityStore.getState().clear());

  it("shows a draft-tier call on its draft until the call settles, then reports it", () => {
    const hook = renderHook(() => useDraftActivity(7));
    expect(hook.result.current).toBeNull();

    act(() => {
      expect(
        trackDraftToolEvent(start("t1", "draft", { draftId: 7, locale: "en" }))
      ).toBeNull();
    });
    expect(hook.result.current).toEqual({
      draftId: 7,
      locale: "en",
      label: "Write draft body",
    });

    let settled: unknown;
    act(() => {
      settled = trackDraftToolEvent(
        end("t1", false, undefined, { revision: 4 })
      );
    });
    expect(settled).toEqual({
      draftId: 7,
      locale: "en",
      label: "Write draft body",
      revision: 4,
    });
    expect(hook.result.current).toBeNull();
  });

  it("reports a call whose result names no revision", () => {
    trackDraftToolEvent(start("t1", "draft", { draftId: 7 }));
    expect(trackDraftToolEvent(end("t1"))).toEqual({
      draftId: 7,
      label: "Write draft body",
    });
  });

  it("ignores other tiers, calls without a draft id, and unknown ends", () => {
    trackDraftToolEvent(start("t1", "read", { draftId: 7 }));
    trackDraftToolEvent(start("t2", "draft", { title: "x" }));
    expect(draftActivityStore.getState().running.size).toBe(0);
    expect(trackDraftToolEvent(end("t9"))).toBeNull();
  });

  it("clears a failed or aborted call without reporting a change", () => {
    trackDraftToolEvent(start("t1", "draft", { draftId: 7 }));
    expect(trackDraftToolEvent(end("t1", true))).toBeNull();
    trackDraftToolEvent(start("t2", "draft", { draftId: 7 }));
    expect(trackDraftToolEvent(end("t2", false, true))).toBeNull();
    expect(draftActivityStore.getState().running.size).toBe(0);
  });

  it("keeps activity on other drafts apart", () => {
    trackDraftToolEvent(start("t1", "draft", { draftId: 7 }));
    const other = renderHook(() => useDraftActivity(8));
    expect(other.result.current).toBeNull();
  });
});
