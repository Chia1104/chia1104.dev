import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, vi } from "vitest";

import type { DB } from "@chia/db/client";
import type { MediaAchievement, MediaEntry } from "@chia/db/schema";
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

const { repo, catalogue, image, playStats } = vi.hoisted(() => ({
  repo: {
    listMediaEntries: vi.fn(),
    listMediaAchievements: vi.fn(),
    replaceMediaAchievements: vi.fn(),
    getMediaEntry: vi.fn(),
    getMediaEntryBySlug: vi.fn(),
    getMediaEntryBySource: vi.fn(),
    updateMediaPlayStats: vi.fn(),
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
  playStats: {
    readSteamPlaySync: vi.fn(),
  },
}));

vi.mock("@chia/db/repos/media", () => repo);
vi.mock("../play-stats.service", () => playStats);
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
  slug: "frieren-beyond-journeys-end",
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
  steamAppId: null,
  playtimeMinutes: null,
  achievementsUnlocked: null,
  achievementsTotal: null,
  lastPlayedAt: null,
  createdAt: new Date("2026-11-01T00:00:00Z"),
  updatedAt: new Date("2026-11-01T00:00:00Z"),
  ...overrides,
});

const achievement = {
  apiName: "ACH39",
  translations: {
    en: { name: "Elden Lord", description: "Achieved the Elden Lord ending" },
    "zh-TW": { name: "艾爾登之王" },
  },
  iconUrl:
    "https://shared.fastly.steamstatic.com/community_assets/images/apps/1245620/a.jpg",
  lockedIconUrl:
    "https://shared.fastly.steamstatic.com/community_assets/images/apps/1245620/b.jpg",
  hidden: false,
  globalPercent: 24.9,
  unlocked: true,
  unlockedAt: new Date("2026-10-30T12:00:00Z"),
};

const achievementRow: MediaAchievement = {
  id: 1,
  mediaEntryId: 4,
  ...achievement,
  createdAt: new Date("2026-11-01T00:00:00Z"),
  updatedAt: new Date("2026-11-01T00:00:00Z"),
};

const log = {
  status: MediaStatus.Completed,
  rating: 9,
  favorite: true,
  startedOn: null,
  finishedOn: "2024-03-22",
};

const noPlayStats = {
  steamAppId: null,
  playtimeMinutes: null,
  achievementsUnlocked: null,
  achievementsTotal: null,
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
    repo.getMediaEntry.mockResolvedValue(row());
    repo.getMediaEntryBySlug.mockResolvedValue(undefined);
    repo.getMediaEntryBySource.mockResolvedValue(undefined);
    repo.updateMediaPlayStats.mockImplementation(
      async (_db: DB, id: number, stats: Partial<MediaEntry>) =>
        row({ ...stats, id })
    );
    repo.listMediaAchievements.mockResolvedValue([]);
    repo.replaceMediaAchievements.mockResolvedValue(undefined);
    playStats.readSteamPlaySync.mockResolvedValue({
      stats: {
        playtimeMinutes: 5220,
        achievementsUnlocked: 31,
        achievementsTotal: 42,
        lastPlayedAt: new Date("2026-11-01T00:00:00Z"),
      },
      achievements: [achievement],
    });
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
      steamAppId: null,
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

    it("reads one work by its slug with its achievements and answers NOT_FOUND for an unknown one", async () => {
      repo.getMediaEntryBySlug.mockResolvedValueOnce(row());
      repo.listMediaAchievements.mockResolvedValueOnce([achievementRow]);
      const found = await call(
        routes.getMediaEntryRoute,
        { slug: "frieren-beyond-journeys-end" },
        { context }
      );
      expect(found.entry.id).toBe(4);
      expect(repo.listMediaAchievements).toHaveBeenCalledWith(
        expect.anything(),
        4
      );
      expect(found.achievements).toEqual([achievement]);

      await expect(
        call(routes.getMediaEntryRoute, { slug: "nope" }, { context })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
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
      slug: "frieren-beyond-journeys-end",
      steamAppId: null,
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
      steamAppId: null,
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

  it("takes the next slug when the readable one is taken", async ({
    context,
  }) => {
    repo.getMediaEntryBySlug.mockResolvedValueOnce(row());

    await call(
      routes.createMediaEntryRoute,
      {
        kind: MediaKind.Anime,
        source: MediaSource.Anilist,
        sourceId: "154587",
        ...log,
      },
      { context }
    );
    expect(repo.createMediaEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ slug: "frieren-beyond-journeys-end-2023" })
    );
  });

  it("stores a game's Steam stats and achievements when it is logged, and logs it without them when Steam fails", async ({
    context,
  }) => {
    const game = {
      translations: { en: { title: "Elden Ring" } },
      originalTitle: null,
      releaseYear: 2022,
      posterUrl: null,
      backdropUrl: null,
      color: null,
      steamAppId: 1245620,
      sourceUrl: "https://www.igdb.com/games/elden-ring",
    };
    const input = {
      kind: MediaKind.Game,
      source: MediaSource.Igdb,
      sourceId: "119133",
      ...log,
    };

    catalogue.resolveMediaSnapshot.mockResolvedValueOnce(game);
    await call(routes.createMediaEntryRoute, input, { context });
    expect(playStats.readSteamPlaySync).toHaveBeenCalledWith(
      1245620,
      undefined
    );
    expect(repo.replaceMediaAchievements).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      9,
      [achievement]
    );
    expect(repo.createMediaEntry).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        slug: "elden-ring",
        steamAppId: 1245620,
        playtimeMinutes: 5220,
        achievementsUnlocked: 31,
        achievementsTotal: 42,
      })
    );

    catalogue.resolveMediaSnapshot.mockResolvedValueOnce(game);
    playStats.readSteamPlaySync.mockRejectedValueOnce(new Error("403"));
    await call(routes.createMediaEntryRoute, input, { context });
    expect(repo.createMediaEntry).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.not.objectContaining({ playtimeMinutes: expect.anything() })
    );
    expect(repo.replaceMediaAchievements).toHaveBeenCalledOnce();
  });

  it("syncs play stats and achievements from Steam, and refuses an entry with no app or one Steam does not list", async ({
    context,
  }) => {
    await expect(
      call(routes.syncMediaEntryRoute, { id: 4 }, { context })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(playStats.readSteamPlaySync).not.toHaveBeenCalled();

    repo.getMediaEntry.mockResolvedValue(row({ steamAppId: 1245620 }));
    const synced = await call(
      routes.syncMediaEntryRoute,
      { id: 4 },
      { context }
    );
    expect(repo.updateMediaPlayStats).toHaveBeenCalledWith(
      expect.anything(),
      4,
      expect.objectContaining({ playtimeMinutes: 5220 })
    );
    expect(synced.entry.achievementsTotal).toBe(42);
    expect(repo.replaceMediaAchievements).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      4,
      [achievement]
    );
    expect(startSiteRevalidation).toHaveBeenCalledWith(WwwCacheTag.Media);

    playStats.readSteamPlaySync.mockResolvedValueOnce(null);
    await expect(
      call(routes.syncMediaEntryRoute, { id: 4 }, { context })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("drops a game's achievements when its Steam app changes, and keeps them otherwise", async ({
    context,
  }) => {
    const patch = {
      id: 4,
      translations: { en: { title: "Elden Ring" } },
      originalTitle: null,
      releaseYear: 2022,
      color: null,
      ...log,
      ...noPlayStats,
    };
    repo.getMediaEntry.mockResolvedValue(row({ steamAppId: 1245620 }));

    await call(
      routes.updateMediaEntryRoute,
      { ...patch, steamAppId: 1245620 },
      { context }
    );
    expect(repo.replaceMediaAchievements).not.toHaveBeenCalled();

    await call(routes.updateMediaEntryRoute, patch, { context });
    expect(repo.replaceMediaAchievements).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      4,
      []
    );
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
          ...noPlayStats,
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
