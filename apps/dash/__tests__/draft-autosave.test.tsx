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
  contentHash: "hash",
  appliedRevisionId: null,
  appliedHash: null,
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
  const echoPatch = () => {
    let revision = initial.revision;
    api.patch.mockImplementation(
      async ({
        translations,
      }: {
        translations: Parameters<typeof applyPatch>[1]["translations"];
      }) => ({
        ...initial,
        ...applyPatch(toValues(initial), { translations }),
        revision: ++revision,
      })
    );
  };

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

  it("keeps unsaved edits in the browser, with what they replaced, and resumes them", async () => {
    const first = setup();
    act(() =>
      first.result.current.form.setValue("translations.en.title", "Offline")
    );
    expect(readDraftSnapshot(initial.id)).toEqual({
      patch: { translations: { en: { title: "Offline" } } },
      seen: { translations: { en: { title: "Title" } } },
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
      {
        draftId: initial.id,
        translations: { en: { title: "Offline" } },
        base: { translations: { en: { title: "Title" } } },
      },
      expect.anything()
    );
    expect(second.result.current.isDirty).toBe(false);
    expect(readDraftSnapshot(initial.id)).toBeNull();
  });

  it("carries kept edits onto a draft that moved in other fields", async () => {
    draftSnapshotStore
      .getState()
      .keep(initial.id, { patch: { slug: "mine" }, seen: { slug: null } });
    const newer: DraftView = {
      ...initial,
      ...applyPatch(toValues(initial), {
        translations: { en: { title: "Remote" } },
      }),
      revision: 2,
    };
    api.patch.mockResolvedValueOnce({ ...newer, slug: "mine", revision: 3 });
    const { result } = setup(newer);
    await act(() => Promise.resolve());
    expect(result.current.issue).toBeNull();
    expect(result.current.form.getValues("translations.en.title")).toBe(
      "Remote"
    );
    expect(api.patch).toHaveBeenLastCalledWith(
      { draftId: initial.id, slug: "mine", base: { slug: null } },
      expect.anything()
    );
    expect(result.current.isDirty).toBe(false);
  });

  it("offers kept edits as a conflict only when the same field moved", async () => {
    draftSnapshotStore
      .getState()
      .keep(initial.id, { patch: { slug: "mine" }, seen: { slug: null } });
    const newer = { ...initial, slug: "theirs", revision: 2 };
    const { result } = setup(newer);
    await act(() => Promise.resolve());
    expect(result.current.issue).toEqual({ kind: "conflict", draft: newer });
    expect(result.current.form.getValues("slug")).toBe("mine");
    // What the edit replaced stays as it was kept: the conflict is not resolved yet.
    expect(readDraftSnapshot(initial.id)).toEqual({
      patch: { slug: "mine" },
      seen: { slug: null },
    });
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(api.patch).not.toHaveBeenCalled();

    api.patch.mockResolvedValueOnce({ ...newer, slug: "mine", revision: 3 });
    await act(async () => result.current.keepMine());
    expect(api.patch).toHaveBeenLastCalledWith(
      { draftId: initial.id, slug: "mine", base: { slug: "theirs" } },
      expect.anything()
    );
    expect(result.current.issue).toBeNull();
    expect(result.current.isDirty).toBe(false);
    expect(readDraftSnapshot(initial.id)).toBeNull();
  });

  it("asks again after a reload that left the conflict unresolved, instead of saving over the remote edit", async () => {
    draftSnapshotStore
      .getState()
      .keep(initial.id, { patch: { slug: "mine" }, seen: { slug: null } });
    const newer = { ...initial, slug: "theirs", revision: 2 };

    const first = setup(newer);
    await act(() => Promise.resolve());
    expect(first.result.current.issue).toEqual({
      kind: "conflict",
      draft: newer,
    });
    first.unmount();

    const second = setup(newer);
    await act(() => Promise.resolve());
    expect(second.result.current.issue).toEqual({
      kind: "conflict",
      draft: newer,
    });
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(api.patch).not.toHaveBeenCalled();
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
    await act(() => Promise.resolve());
    expect(api.patch).toHaveBeenLastCalledWith(
      {
        draftId: initial.id,
        translations: { en: { title: "Second" } },
        base: { translations: { en: { title: "First" } } },
      },
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

  it("takes remote changes beside local edits and stops only where both changed a field", () => {
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
    act(() =>
      result.current.receive({
        ...remote,
        ...applyPatch(toValues(remote), {
          translations: { en: { content: "Remote body" } },
        }),
        revision: 3,
      })
    );
    expect(result.current.form.getValues("translations.en.title")).toBe("Mine");
    expect(result.current.form.getValues("translations.en.content")).toBe(
      "Remote body"
    );
    expect(result.current.saved.revision).toBe(3);
    expect(result.current.issue).toBeNull();

    const theirs = {
      ...remote,
      ...applyPatch(toValues(remote), {
        translations: { en: { title: "Theirs", content: "Remote body" } },
      }),
      revision: 4,
    };
    act(() => result.current.receive(theirs));
    expect(result.current.form.getValues("translations.en.title")).toBe("Mine");
    expect(result.current.issue).toEqual({ kind: "conflict", draft: theirs });
  });

  it("merges a body the agent changed elsewhere while it was being typed in", () => {
    const body = "# Post\n\nFirst paragraph.\n\nSecond paragraph.\n";
    const draft = {
      ...initial,
      ...applyPatch(toValues(initial), {
        translations: { en: { content: body } },
      }),
    };
    const { result } = setup(draft);
    act(() =>
      result.current.form.setValue(
        "translations.en.content",
        body.replace("First paragraph.", "First paragraph, typed.")
      )
    );
    act(() =>
      result.current.receive({
        ...draft,
        ...applyPatch(toValues(draft), {
          translations: {
            en: { content: body.replace("Second", "Second, by the agent") },
          },
        }),
        revision: 2,
      })
    );
    expect(result.current.issue).toBeNull();
    expect(result.current.form.getValues("translations.en.content")).toBe(
      "# Post\n\nFirst paragraph, typed.\n\nSecond, by the agent paragraph.\n"
    );
    expect(result.current.isDirty).toBe(true);
  });

  it("rebases a rejected write onto the latest draft and sends it again", async () => {
    const { result, loadLatest } = setup();
    const remote = {
      ...initial,
      ...applyPatch(toValues(initial), {
        translations: { en: { content: "Remote body" } },
      }),
      revision: 2,
    };
    loadLatest.mockResolvedValue(remote);
    api.patch
      .mockRejectedValueOnce(new ORPCError("CONFLICT"))
      .mockResolvedValueOnce({
        ...remote,
        ...applyPatch(toValues(remote), {
          translations: { en: { title: "Mine" } },
        }),
        revision: 3,
      });
    act(() => result.current.form.setValue("translations.en.title", "Mine"));
    await act(async () => {
      expect(await result.current.flush()).toBe(true);
    });
    expect(api.patch).toHaveBeenCalledTimes(2);
    expect(result.current.form.getValues("translations.en.content")).toBe(
      "Remote body"
    );
    expect(result.current.form.getValues("translations.en.title")).toBe("Mine");
    expect(result.current.isDirty).toBe(false);
  });

  it("stops when the rejected field moved on both sides, until the operator picks", async () => {
    api.patch.mockRejectedValueOnce(new ORPCError("CONFLICT"));
    const { result, loadLatest } = setup();
    const remote = {
      ...initial,
      ...applyPatch(toValues(initial), {
        translations: { en: { title: "Theirs" } },
      }),
      revision: 2,
    };
    loadLatest.mockResolvedValue(remote);
    act(() => result.current.form.setValue("translations.en.title", "Mine"));
    await act(async () => {
      expect(await result.current.flush()).toBe(false);
    });
    expect(result.current.issue).toEqual({ kind: "conflict", draft: remote });
    await act(() => vi.advanceTimersByTimeAsync(20_000));
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
    expect(api.patch).toHaveBeenLastCalledWith(
      {
        draftId: initial.id,
        translations: { en: { title: "Mine" } },
        base: { translations: { en: { title: "Theirs" } } },
      },
      expect.anything()
    );
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
