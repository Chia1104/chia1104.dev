import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, vi } from "vitest";

import type { DB } from "@chia/db/client";
import type { MediaEntry } from "@chia/db/schema";
import { MediaKind, MediaSource, MediaStatus } from "@chia/db/types";
import { contextOf } from "@chia/test/context";
import { stubTestEnv } from "@chia/test/env";
import { it as orpcIt } from "@chia/test/orpc";
import { ADMIN_ID, sessionOf } from "@chia/test/session";
import { WwwCacheTag } from "@chia/utils/config";
import { createWorkflowControlClient } from "@chia/workflow-control/client";

import type { BaseOSContext } from "../../shared/context";
import type * as catalogueModule from "../catalogue.service";
import type * as imageModule from "../image.service";
import type * as mediaRouteModule from "../media.route";

const { repo, catalogue, image } = vi.hoisted(() => ({
  repo: {
    listMediaEntries: vi.fn(),
    getMediaEntryBySource: vi.fn(),
    createMediaEntry: vi.fn(),
    updateMediaEntry: vi.fn(),
    deleteMediaEntry: vi.fn(),
  },
  catalogue: {
    searchMediaCatalogues: vi.fn(),
    resolveMediaSnapshot: vi.fn(),
  },
  image: {
    storeMediaImage: vi.fn(),
    dominantColorOf: vi.fn(),
    removeMediaImage: vi.fn(),
  },
}));

vi.mock("@chia/db/repos/media", () => repo);
vi.mock("../image.service", async (importOriginal) => ({
  ...(await importOriginal<typeof imageModule>()),
  ...image,
}));
vi.mock("../catalogue.service", async (importOriginal) => ({
  ...(await importOriginal<typeof catalogueModule>()),
  ...catalogue,
}));

const workflowClient = createWorkflowControlClient({
  url: "http://workflow.test",
  token: "test",
  fetch: () => Promise.reject(new Error("unmocked workflow command")),
});
const startSiteRevalidation = vi.spyOn(workflowClient, "startSiteRevalidation");

const it = orpcIt.extend("context", ({ session }) =>
  contextOf<BaseOSContext>(session, { workflow: workflowClient })
);

const row = (overrides: Partial<MediaEntry> = {}): MediaEntry => ({
  id: 4,
  kind: MediaKind.Anime,
  source: MediaSource.Anilist,
  sourceId: "154587",
  sourceUrl: "https://anilist.co/anime/154587",
  translations: { en: { title: "Frieren: Beyond Journey’s End" } },
  originalTitle: "葬送のフリーレン",
  releaseYear: 2023,
  poster: "media/anilist-154587-poster.jpg",
  backdrop: "media/anilist-154587-backdrop.jpg",
  color: "#d6e4a1",
  status: MediaStatus.Completed,
  rating: 9,
  favorite: true,
  startedOn: null,
  finishedOn: "2024-03-22",
  createdAt: new Date("2026-11-01T00:00:00Z"),
  updatedAt: new Date("2026-11-01T00:00:00Z"),
  ...overrides,
});

const log = {
  status: MediaStatus.Completed,
  rating: 9,
  favorite: true,
  startedOn: null,
  finishedOn: "2024-03-22",
};

type MediaRoutes = typeof mediaRouteModule;
let routes: MediaRoutes;

describe("media routes", () => {
  beforeAll(async () => {
    stubTestEnv({
      SKIP_ENV_VALIDATION: "true",
      ENV: "test",
      LOCAL_ADMIN_ID: ADMIN_ID,
    });
    routes = await import("../media.route");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    startSiteRevalidation.mockResolvedValue("wrun_1");
    repo.listMediaEntries.mockResolvedValue([row()]);
    repo.getMediaEntryBySource.mockResolvedValue(undefined);
    repo.createMediaEntry.mockImplementation(
      async (_db: DB, input: Partial<MediaEntry>) => row({ ...input, id: 9 })
    );
    repo.updateMediaEntry.mockImplementation(
      async (_db: DB, id: number, patch: Partial<MediaEntry>) =>
        row({ ...patch, id })
    );
    repo.deleteMediaEntry.mockResolvedValue(row());
    catalogue.resolveMediaSnapshot.mockResolvedValue({
      translations: { en: { title: "Frieren: Beyond Journey’s End" } },
      originalTitle: "葬送のフリーレン",
      releaseYear: 2023,
      posterUrl: "https://img.example/frieren.jpg",
      backdropUrl: "https://img.example/frieren-banner.jpg",
      color: null,
      sourceUrl: "https://anilist.co/anime/154587",
    });
    image.storeMediaImage.mockImplementation(
      async (_source: string, sourceId: string, role: string) => ({
        key: `media/anilist-${sourceId}-${role}.jpg`,
        body: new Uint8Array(),
      })
    );
    image.dominantColorOf.mockResolvedValue("#336699");
    image.removeMediaImage.mockResolvedValue(undefined);
  });

  describe("anonymous", () => {
    const context = contextOf<BaseOSContext>(null, {
      workflow: workflowClient,
    });

    it("reads the log with a storage URL for the cover", async () => {
      const listed = await call(
        routes.listMediaEntriesRoute,
        { kind: MediaKind.Anime, limit: 12 },
        { context }
      );
      expect(repo.listMediaEntries).toHaveBeenCalledWith(expect.anything(), {
        kind: MediaKind.Anime,
        limit: 12,
      });
      expect(listed.items[0]?.posterUrl).toBe(
        "https://storage.chia1104.dev/media/anilist-154587-poster.jpg"
      );
      expect(listed.items[0]?.backdropUrl).toBe(
        "https://storage.chia1104.dev/media/anilist-154587-backdrop.jpg"
      );
    });

    it("cannot write", async () => {
      await expect(
        call(routes.removeMediaEntryRoute, { id: 4 }, { context })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(repo.deleteMediaEntry).not.toHaveBeenCalled();
    });
  });

  describe("signed-in non-admin", () => {
    it.override("session", () => sessionOf("someone-else", "user"));

    it("cannot search or write", async ({ context }) => {
      await expect(
        call(
          routes.searchMediaRoute,
          { kind: MediaKind.Anime, query: "frieren" },
          { context }
        )
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(catalogue.searchMediaCatalogues).not.toHaveBeenCalled();
    });
  });

  it("creates from the catalogue snapshot, copies both images, takes the cover's colour and revalidates", async ({
    context,
  }) => {
    const created = await call(
      routes.createMediaEntryRoute,
      {
        kind: MediaKind.Anime,
        source: MediaSource.Anilist,
        sourceId: "154587",
        ...log,
      },
      { context }
    );
    expect(image.storeMediaImage).toHaveBeenCalledWith(
      MediaSource.Anilist,
      "154587",
      "backdrop",
      "https://img.example/frieren-banner.jpg",
      undefined
    );
    expect(repo.createMediaEntry).toHaveBeenCalledWith(expect.anything(), {
      kind: MediaKind.Anime,
      source: MediaSource.Anilist,
      sourceId: "154587",
      sourceUrl: "https://anilist.co/anime/154587",
      translations: { en: { title: "Frieren: Beyond Journey’s End" } },
      originalTitle: "葬送のフリーレン",
      releaseYear: 2023,
      poster: "media/anilist-154587-poster.jpg",
      backdrop: "media/anilist-154587-backdrop.jpg",
      color: "#336699",
      ...log,
    });
    expect(created.entry.id).toBe(9);
    expect(startSiteRevalidation).toHaveBeenCalledWith(WwwCacheTag.Media);
  });

  it("keeps the catalogue's colour and logs the work without images when the copies fail", async ({
    context,
  }) => {
    catalogue.resolveMediaSnapshot.mockResolvedValueOnce({
      translations: { en: { title: "Frieren: Beyond Journey’s End" } },
      originalTitle: "葬送のフリーレン",
      releaseYear: 2023,
      posterUrl: "https://img.example/frieren.jpg",
      backdropUrl: null,
      color: "#d6e4a1",
      sourceUrl: "https://anilist.co/anime/154587",
    });
    image.storeMediaImage.mockRejectedValue(new Error("Image responded 403"));

    const created = await call(
      routes.createMediaEntryRoute,
      {
        kind: MediaKind.Anime,
        source: MediaSource.Anilist,
        sourceId: "154587",
        ...log,
      },
      { context }
    );
    expect(created.entry.posterUrl).toBeNull();
    expect(created.entry.color).toBe("#d6e4a1");
    expect(image.dominantColorOf).not.toHaveBeenCalled();
  });

  it("refuses a catalogue that does not list the kind, a duplicate and an unknown work", async ({
    context,
  }) => {
    await expect(
      call(
        routes.createMediaEntryRoute,
        {
          kind: MediaKind.Game,
          source: MediaSource.Anilist,
          sourceId: "154587",
          ...log,
        },
        { context }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    repo.getMediaEntryBySource.mockResolvedValueOnce(row());
    await expect(
      call(
        routes.createMediaEntryRoute,
        {
          kind: MediaKind.Anime,
          source: MediaSource.Anilist,
          sourceId: "154587",
          ...log,
        },
        { context }
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });

    catalogue.resolveMediaSnapshot.mockResolvedValueOnce(null);
    await expect(
      call(
        routes.createMediaEntryRoute,
        {
          kind: MediaKind.Anime,
          source: MediaSource.Anilist,
          sourceId: "1",
          ...log,
        },
        { context }
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(repo.createMediaEntry).not.toHaveBeenCalled();
    expect(startSiteRevalidation).not.toHaveBeenCalled();
  });

  it("rejects a finish date before the start date", async ({ context }) => {
    await expect(
      call(
        routes.updateMediaEntryRoute,
        {
          id: 4,
          translations: { "zh-TW": { title: "葬送的芙莉蓮" } },
          originalTitle: null,
          releaseYear: 2023,
          color: null,
          ...log,
          startedOn: "2024-04-01",
        },
        { context }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(repo.updateMediaEntry).not.toHaveBeenCalled();
  });

  it("removes the row and its cover, then revalidates", async ({ context }) => {
    await expect(
      call(routes.removeMediaEntryRoute, { id: 4 }, { context })
    ).resolves.toEqual({ id: 4 });
    expect(image.removeMediaImage).toHaveBeenCalledWith(
      "media/anilist-154587-poster.jpg"
    );
    expect(image.removeMediaImage).toHaveBeenCalledWith(
      "media/anilist-154587-backdrop.jpg"
    );
    expect(startSiteRevalidation).toHaveBeenCalledWith(WwwCacheTag.Media);

    repo.deleteMediaEntry.mockResolvedValueOnce(undefined);
    await expect(
      call(routes.removeMediaEntryRoute, { id: 5 }, { context })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
