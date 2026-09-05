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

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const onSaved = vi.fn();
  const loadLatest = vi.fn<() => Promise<DraftView>>();
  const hook = renderHook(
    () => {
      const form = useForm<DraftFormValues>({
        defaultValues: { ...toValues(initial), activeLocale: "en" },
      });
      return {
        form,
        ...useDraftAutosave({ initial, form, onSaved, loadLatest }),
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
  });
  afterEach(() => vi.useRealTimers());

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
