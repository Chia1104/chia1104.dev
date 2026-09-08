import type { ReactNode } from "react";

import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DraftFormValues } from "../src/components/feed/draft-form-schema";
import { applyPatch, toValues } from "../src/components/feed/draft-values";
import type { DraftView } from "../src/components/feed/draft-values";

const api = vi.hoisted(() => ({ patch: vi.fn() }));
vi.mock("@/libs/orpc/client", () => ({
  orpc: {
    feeds: {
      "draft:patch": { mutationOptions: () => ({ mutationFn: api.patch }) },
    },
  },
}));
const { useDraftAutosave } =
  await import("../src/components/feed/use-draft-autosave");
const { draftSnapshotStore, readDraftSnapshot } =
  await import("../src/components/feed/draft-snapshot");

const initial: DraftView = {
  id: 7,
  feedId: null,
  revision: 1,
  appliedRevision: null,
  slug: null,
  type: "post",
  defaultLocale: "en",
  mainImage: null,
  translations: {
    en: {
      title: "Title",
      content: "Body",
      description: null,
      excerpt: null,
      summary: null,
    },
  },
  createdAt: "2026-09-05T00:00:00Z",
  updatedAt: "2026-09-05T00:00:00Z",
};

const setup = (draft: DraftView = initial) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const onSaved = vi.fn();
  const loadLatest = vi.fn<() => Promise<DraftView>>();
  const hook = renderHook(
    () => {
      const form = useForm<DraftFormValues>({
        defaultValues: { ...toValues(draft), activeLocale: "en" },
      });
      return {
        form,
        ...useDraftAutosave({ initial: draft, form, onSaved, loadLatest }),
      };
    },
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    }
  );
  return { ...hook, onSaved, loadLatest };
};

describe("draft autosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api.patch.mockReset();
    draftSnapshotStore.setState({ entries: [] });
    localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  /** Echoes the patched translations at the next revision. */
  const echoPatch = () =>
    api.patch.mockImplementation(
      async ({
        translations,
        expectedRevision,
      }: {
        translations: Parameters<typeof applyPatch>[1]["translations"];
        expectedRevision: number;
      }) => ({
        ...initial,
        ...applyPatch(toValues(initial), { translations }),
        revision: expectedRevision + 1,
      })
    );

  it("saves three seconds after the last edit", async () => {
    echoPatch();
    const { result } = setup();
    act(() => result.current.form.setValue("translations.en.title", "One"));
    await act(() => vi.advanceTimersByTimeAsync(2900));
    expect(api.patch).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(result.current.isDirty).toBe(false);
  });

  it("saves at most fifteen seconds after the first edit while typing continues", async () => {
    echoPatch();
    const { result } = setup();
    for (let second = 0; second < 15; second += 2) {
      act(() =>
        result.current.form.setValue("translations.en.title", `T${second}`)
      );
      await act(() => vi.advanceTimersByTimeAsync(second === 14 ? 900 : 2000));
    }
    expect(api.patch).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(api.patch).toHaveBeenLastCalledWith(
      expect.objectContaining({ translations: { en: { title: "T14" } } }),
      expect.anything()
    );
  });

  it("saves at once when the tab is hidden", async () => {
    echoPatch();
    const { result } = setup();
    act(() => result.current.form.setValue("translations.en.title", "Away"));
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    try {
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
    } finally {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      });
    }
    expect(api.patch).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(api.patch).toHaveBeenCalledTimes(1);
  });

  it("keeps unsaved edits in the browser and resumes them on the same revision", async () => {
    const first = setup();
    act(() =>
      first.result.current.form.setValue("translations.en.title", "Offline")
    );
    expect(readDraftSnapshot(initial.id)).toEqual({
      revision: 1,
      patch: { translations: { en: { title: "Offline" } } },
    });
    expect(localStorage.getItem("chia.dash.draft-snapshots")).toContain(
      "Offline"
    );
    first.unmount();

    echoPatch();
    const second = setup();
    await act(() => Promise.resolve());
    expect(second.result.current.form.getValues("translations.en.title")).toBe(
      "Offline"
    );
    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(api.patch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expectedRevision: 1,
        translations: { en: { title: "Offline" } },
      }),
      expect.anything()
    );
    expect(second.result.current.isDirty).toBe(false);
    expect(readDraftSnapshot(initial.id)).toBeNull();
  });

  it("offers edits made against an older revision as a conflict", async () => {
    draftSnapshotStore
      .getState()
      .keep(initial.id, { revision: 1, patch: { slug: "mine" } });
    const newer = { ...initial, revision: 2 };
    const { result } = setup(newer);
    await act(() => Promise.resolve());
    expect(result.current.issue).toEqual({ kind: "conflict", draft: newer });
    expect(result.current.form.getValues("slug")).toBe("mine");
    expect(readDraftSnapshot(initial.id)).toEqual({
      revision: 2,
      patch: { slug: "mine" },
    });
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(api.patch).not.toHaveBeenCalled();

    api.patch.mockResolvedValueOnce({ ...newer, slug: "mine", revision: 3 });
    await act(async () => result.current.keepMine());
    expect(api.patch).toHaveBeenLastCalledWith(
      expect.objectContaining({ expectedRevision: 2, slug: "mine" }),
      expect.anything()
    );
    expect(result.current.issue).toBeNull();
    expect(result.current.isDirty).toBe(false);
    expect(readDraftSnapshot(initial.id)).toBeNull();
  });

  it("ignores locale navigation and reverting an edit before the debounce", async () => {
    const { result } = setup();
    act(() => result.current.form.setValue("activeLocale", "zh-TW"));
    act(() => result.current.form.setValue("translations.en.title", "Changed"));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.form.setValue("translations.en.title", "Title"));
    expect(result.current.isDirty).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("shares the in-flight save and drains edits made while it was pending", async () => {
    const first = Promise.withResolvers<DraftView>();
    const second = Promise.withResolvers<DraftView>();
    api.patch
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = setup();
    act(() => result.current.form.setValue("translations.en.title", "First"));
    let saving!: Promise<boolean>;
    await act(async () => {
      saving = result.current.flush();
    });
    act(() => result.current.form.setValue("translations.en.title", "Second"));
    expect(result.current.flush()).toBe(saving);
    await act(async () =>
      first.resolve({
        ...initial,
        ...applyPatch(toValues(initial), {
          translations: { en: { title: "First" } },
        }),
        revision: 2,
      })
    );
    expect(api.patch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expectedRevision: 2,
        translations: { en: { title: "Second" } },
      }),
      expect.anything()
    );
    await act(async () => {
      second.resolve({
        ...initial,
        ...applyPatch(toValues(initial), {
          translations: { en: { title: "Second" } },
        }),
        revision: 3,
      });
      expect(await saving).toBe(true);
    });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.saved.revision).toBe(3);
  });

  it("loads idle remote changes but preserves a dirty form", () => {
    const { result } = setup();
    const remote = {
      ...initial,
      ...applyPatch(toValues(initial), {
        translations: { en: { title: "Remote" } },
      }),
      revision: 2,
    };
    act(() => result.current.receive(remote));
    expect(result.current.form.getValues("translations.en.title")).toBe(
      "Remote"
    );
    act(() => result.current.form.setValue("translations.en.title", "Mine"));
    act(() => result.current.receive({ ...remote, revision: 3 }));
    expect(result.current.form.getValues("translations.en.title")).toBe("Mine");
    expect(result.current.saved.revision).toBe(2);
  });

  it("stops on conflicts and keeps only edited fields over the remote revision", async () => {
    api.patch.mockRejectedValueOnce(new ORPCError("CONFLICT"));
    const { result, loadLatest } = setup();
    const remote = {
      ...initial,
      ...applyPatch(toValues(initial), {
        translations: { en: { content: "Remote body" } },
      }),
      revision: 2,
    };
    loadLatest.mockResolvedValue(remote);
    act(() => result.current.form.setValue("translations.en.title", "Mine"));
    await act(async () => {
      expect(await result.current.flush()).toBe(false);
    });
    await act(() => vi.advanceTimersByTimeAsync(2000));
    await act(async () => {
      expect(await result.current.retry()).toBe(false);
    });
    expect(api.patch).toHaveBeenCalledTimes(1);
    api.patch.mockResolvedValueOnce({
      ...remote,
      ...applyPatch(toValues(remote), {
        translations: { en: { title: "Mine" } },
      }),
      revision: 3,
    });
    await act(async () => result.current.keepMine());
    expect(result.current.form.getValues("translations.en.content")).toBe(
      "Remote body"
    );
    expect(result.current.form.getValues("translations.en.title")).toBe("Mine");
    expect(result.current.isDirty).toBe(false);
  });

  it("reports a failed conflict reload and allows an explicit retry", async () => {
    api.patch.mockRejectedValueOnce(new ORPCError("CONFLICT"));
    const { result, loadLatest } = setup();
    loadLatest.mockRejectedValueOnce(new Error("Offline"));
    act(() => result.current.form.setValue("slug", "new-slug"));
    await act(async () => {
      expect(await result.current.flush()).toBe(false);
    });
    expect(result.current.issue).toEqual({ kind: "error", message: "Offline" });
    api.patch.mockResolvedValueOnce({
      ...initial,
      slug: "new-slug",
      revision: 2,
    });
    await act(async () => {
      expect(await result.current.retry()).toBe(true);
    });
    expect(result.current.issue).toBeNull();
    expect(result.current.isDirty).toBe(false);
  });
});
