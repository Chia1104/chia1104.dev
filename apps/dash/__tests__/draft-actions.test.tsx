import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { orpc } from "@/libs/orpc/client";

import type { DraftView } from "../src/components/feed/draft-values";

const api = vi.hoisted(() => ({
  apply: vi.fn(),
  discard: vi.fn(),
  restore: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("nuqs", () => ({ useQueryState: () => [null, vi.fn()] }));
vi.mock("@/libs/orpc/client", () => ({
  client: {
    feeds: {
      "draft:apply": api.apply,
      "draft:discard": api.discard,
      "draft:restore": api.restore,
    },
  },
  orpc: {
    feeds: {
      "draft:apply": {
        mutationOptions: (
          options: Parameters<
            (typeof orpc.feeds)["draft:apply"]["mutationOptions"]
          >[0]
        ) => options,
      },
      "draft:discard": {
        mutationOptions: (
          options: Parameters<
            (typeof orpc.feeds)["draft:discard"]["mutationOptions"]
          >[0]
        ) => options,
      },
    },
  },
}));
vi.mock("../src/components/feed/revisions-drawer", () => ({
  RevisionsDrawer: () => null,
}));
const { DraftActions } = await import("../src/components/feed/draft-actions");
const draft: DraftView = {
  id: 7,
  feedId: null,
  revision: 1,
  appliedRevision: null,
  slug: null,
  type: "post",
  defaultLocale: "en",
  mainImage: null,
  translations: {},
  createdAt: "2026-09-05T00:00:00Z",
  updatedAt: "2026-09-05T00:00:00Z",
};

const setup = (beforeAction: () => Promise<boolean>) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }>
      <DraftActions
        draft={draft}
        beforeAction={beforeAction}
        hasLocalChanges
        isSaveBlocked={false}
        onDraftChanged={vi.fn()}
        status="Unsaved changes">
        <div data-testid="editor">Editor</div>
      </DraftActions>
    </QueryClientProvider>
  );

describe("draft actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("waits for all saves before creating a post and locks the editor during the action", async () => {
    const saving = Promise.withResolvers<boolean>();
    api.apply.mockReturnValue(Promise.withResolvers<void>().promise);
    const beforeAction = vi.fn(() => saving.promise);
    setup(beforeAction);
    fireEvent.click(screen.getByRole("button", { name: "Create post" }));
    await waitFor(() => expect(beforeAction).toHaveBeenCalledOnce());
    expect(api.apply).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("editor").parentElement?.hasAttribute("inert")
    ).toBe(true);
    saving.resolve(true);
    await waitFor(() => expect(api.apply).toHaveBeenCalledWith({ draftId: 7 }));
  });

  it("does not apply after a failed save or conflict", async () => {
    const beforeAction = vi.fn(async () => false);
    setup(beforeAction);
    fireEvent.click(screen.getByRole("button", { name: "Create post" }));
    await waitFor(() => expect(beforeAction).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(
        screen.getByTestId("editor").parentElement?.hasAttribute("inert")
      ).toBe(false)
    );
    expect(api.apply).not.toHaveBeenCalled();
  });
});
