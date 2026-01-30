import type { RelationsFilterColumns, KnownKeysOnly } from "drizzle-orm";
import { eq } from "drizzle-orm";

import dayjs from "@chia/utils/day";

import type { Locale, relations } from "../../schemas/index.ts";
import { feeds, feedTranslations, contents } from "../../schemas/index.ts";
import { FeedOrderBy, FeedType, Locale as LocaleEnum } from "../../types.ts";
import { cursorTransform, dateToTimestamp, withDTO } from "../index.ts";
import type {
  InfiniteDTO,
  InsertFeedDTO,
  InsertFeedTranslationDTO,
  InsertContentDTO,
  UpdateFeedDTO,
  UpdateFeedTranslationDTO,
} from "../validator/feeds.ts";

export const getFeedBySlug = withDTO(
  async (db, params: { slug: string; locale?: Locale }) => {
    const locale = params.locale;
    const feed = await db.query.feeds.findFirst({
      where: {
        slug: params.slug,
      },
      with: {
        translations: {
          where: {
            locale,
          },
          with: {
            content: true,
          },
        },
        feedsToTags: {
          with: {
            tag: {
              with: {
                translations: true,
              },
            },
          },
        },
      },
    });

    if (!feed) {
      return null;
    }

    return {
      ...feed,
      createdAt: dayjs(feed.createdAt).toISOString(),
      updatedAt: dayjs(feed.updatedAt).toISOString(),
      translations: feed.translations.map((t) => ({
        ...t,
        createdAt: dayjs(t.createdAt).toISOString(),
        updatedAt: dayjs(t.updatedAt).toISOString(),
        content: t.content
          ? {
              ...t.content,
              createdAt: dayjs(t.content.createdAt).toISOString(),
              updatedAt: dayjs(t.content.updatedAt).toISOString(),
            }
          : null,
      })),
    };
  }
);

export const getFeedById = withDTO(
  async (db, params: { feedId: number; locale?: Locale }) => {
    const locale = params.locale;
    const feed = await db.query.feeds.findFirst({
      where: {
        id: params.feedId,
      },
      with: {
        translations: {
          where: {
            locale,
          },
          with: {
            content: true,
          },
        },
        feedsToTags: {
          with: {
            tag: {
              with: {
                translations: true,
              },
            },
          },
        },
      },
    });

    if (!feed) {
      return null;
    }

    return {
      ...feed,
      createdAt: dayjs(feed.createdAt).toISOString(),
      updatedAt: dayjs(feed.updatedAt).toISOString(),
      translations: feed.translations.map((t) => ({
        ...t,
        createdAt: dayjs(t.createdAt).toISOString(),
        updatedAt: dayjs(t.updatedAt).toISOString(),
        content: t.content
          ? {
              ...t.content,
              createdAt: dayjs(t.content.createdAt).toISOString(),
              updatedAt: dayjs(t.content.updatedAt).toISOString(),
            }
          : null,
      })),
    };
  }
);

export const getInfiniteFeeds = withDTO(
  async (
    db,
    {
      limit = 10,
      cursor,
      orderBy = FeedOrderBy.UpdatedAt,
      sortOrder = "desc",
      type = FeedType.Post,
      locale,
      whereAnd = {},
      withContent = false,
    }: InfiniteDTO & {
      whereAnd?: RelationsFilterColumns<
        KnownKeysOnly<typeof feeds, (typeof relations.feeds)["table"]>
      >;
      locale?: Locale;
    }
  ) => {
    const parsedCursor = cursor
      ? cursorTransform(
          cursor,
          orderBy === FeedOrderBy.UpdatedAt || orderBy === FeedOrderBy.CreatedAt
            ? "date"
            : "default"
        )
      : null;

    const items = await db.query.feeds.findMany({
      orderBy: (feeds, { asc, desc }) => [
        sortOrder === "asc" ? asc(feeds[orderBy]) : desc(feeds[orderBy]),
      ],
      limit: limit + 1,
      with: {
        translations: {
          where: {
            locale,
          },
          with: {
            content: withContent,
          },
        },
        feedsToTags: {
          with: {
            tag: {
              with: {
                translations: {
                  where: {
                    locale: locale,
                  },
                },
              },
            },
          },
        },
      },
      where: {
        type: type === "all" ? undefined : type,
        [orderBy]: parsedCursor
          ? {
              [sortOrder === "asc" ? "gte" : "lte"]: parsedCursor,
            }
          : undefined,
        ...whereAnd,
      },
    });

    let nextCursor: ReturnType<typeof cursorTransform> | null = null;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor =
        orderBy === FeedOrderBy.UpdatedAt || orderBy === FeedOrderBy.CreatedAt
          ? dateToTimestamp(nextItem?.[orderBy] as dayjs.ConfigType)
          : (nextItem?.[orderBy] ?? null);
    }

    const serializedItems = items.map((item) => ({
      ...item,
      createdAt: dayjs(item.createdAt).toISOString(),
      updatedAt: dayjs(item.updatedAt).toISOString(),
      translations: item.translations.map((t) => ({
        ...t,
        createdAt: dayjs(t.createdAt).toISOString(),
        updatedAt: dayjs(t.updatedAt).toISOString(),
        content: t.content
          ? {
              ...t.content,
              createdAt: dayjs(t.content.createdAt).toISOString(),
              updatedAt: dayjs(t.content.updatedAt).toISOString(),
            }
          : null,
      })),
    }));

    return {
      items: serializedItems,
      nextCursor,
    };
  }
);

export const getInfiniteFeedsByUserId = withDTO(
  async (
    db,
    {
      limit = 10,
      cursor,
      orderBy = FeedOrderBy.UpdatedAt,
      sortOrder = "desc",
      type = FeedType.Post,
      userId,
      locale,
      whereAnd = {},
      withContent = false,
    }: InfiniteDTO & {
      userId: string;
      whereAnd?: RelationsFilterColumns<
        KnownKeysOnly<typeof feeds, (typeof relations.feeds)["table"]>
      >;
      locale?: Locale;
    }
  ) => {
    const parsedCursor = cursor
      ? cursorTransform(
          cursor,
          orderBy === FeedOrderBy.UpdatedAt || orderBy === FeedOrderBy.CreatedAt
            ? "date"
            : "default"
        )
      : null;

    const items = await db.query.feeds.findMany({
      orderBy: (feeds, { asc, desc }) => [
        sortOrder === "asc" ? asc(feeds[orderBy]) : desc(feeds[orderBy]),
      ],
      limit: limit + 1,
      with: {
        translations: {
          where: {
            locale,
          },
          with: {
            content: withContent,
          },
        },
        feedsToTags: {
          with: {
            tag: {
              with: {
                translations: {
                  where: {
                    locale,
                  },
                },
              },
            },
          },
        },
      },
      where: {
        userId,
        type: type === "all" ? undefined : type,
        [orderBy]: parsedCursor
          ? {
              [sortOrder === "asc" ? "gte" : "lte"]: parsedCursor,
            }
          : undefined,
        ...whereAnd,
      },
    });

    let nextCursor: ReturnType<typeof cursorTransform> | null = null;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor =
        orderBy === FeedOrderBy.UpdatedAt || orderBy === FeedOrderBy.CreatedAt
          ? dateToTimestamp(nextItem?.[orderBy] as dayjs.ConfigType)
          : (nextItem?.[orderBy] ?? null);
    }

    const serializedItems = items.map((item) => ({
      ...item,
      createdAt: dayjs(item.createdAt).toISOString(),
      updatedAt: dayjs(item.updatedAt).toISOString(),
      translations: item.translations.map((t) => ({
        ...t,
        createdAt: dayjs(t.createdAt).toISOString(),
        updatedAt: dayjs(t.updatedAt).toISOString(),
        content: t.content
          ? {
              ...t.content,
              createdAt: dayjs(t.content.createdAt).toISOString(),
              updatedAt: dayjs(t.content.updatedAt).toISOString(),
            }
          : null,
      })),
    }));

    return {
      items: serializedItems,
      nextCursor,
    };
  }
);

export const createFeed = withDTO(
  async (
    db,
    dto: InsertFeedDTO & {
      translations: (InsertFeedTranslationDTO & {
        content: Omit<InsertContentDTO, "feedTranslationId">;
      })[];
    }
  ) => {
    return await db.transaction(async (trx) => {
      const [feed] = await trx
        .insert(feeds)
        .values({
          slug: dto.slug,
          type: dto.type,
          contentType: dto.contentType,
          published: dto.published,
          defaultLocale: dto.defaultLocale ?? LocaleEnum.zhTW,
          userId: dto.userId,
          mainImage: dto.mainImage,
          createdAt: dto.createdAt ? dayjs(dto.createdAt).toDate() : undefined,
          updatedAt: dto.updatedAt ? dayjs(dto.updatedAt).toDate() : undefined,
        })
        .returning();

      if (!feed?.id) {
        trx.rollback();
        throw new Error("Failed to create feed");
      }

      const createdTranslations = [];
      const createdContents = [];

      for (const translationInput of dto.translations) {
        const [translation] = await trx
          .insert(feedTranslations)
          .values({
            feedId: feed.id,
            locale: translationInput.locale,
            title: translationInput.title,
            excerpt: translationInput.excerpt,
            description: translationInput.description,
            summary: translationInput.summary,
            readTime: translationInput.readTime,
            embedding: translationInput.embedding ?? undefined,
            embedding512: translationInput.embedding512 ?? undefined,
          })
          .returning();

        if (!translation?.id) {
          trx.rollback();
          throw new Error("Failed to create feed translation");
        }

        createdTranslations.push(translation);

        if (translationInput.content) {
          const [createdContent] = await trx
            .insert(contents)
            .values({
              feedTranslationId: translation.id,
              content: translationInput.content.content,
              source: translationInput.content.source,
              unstableSerializedSource:
                translationInput.content.unstableSerializedSource,
            })
            .returning();

          if (!createdContent?.id) {
            trx.rollback();
            throw new Error("Failed to create content");
          }
          createdContents.push(createdContent);
        }
      }

      return {
        ...feed,
        translations: createdTranslations,
        contents: createdContents,
      };
    });
  }
);

export const updateFeed = withDTO(
  async (db, dto: { feedId: number } & Partial<UpdateFeedDTO>) => {
    const [updatedFeed] = await db
      .update(feeds)
      .set({
        slug: dto.slug,
        type: dto.type,
        contentType: dto.contentType,
        published: dto.published,
        defaultLocale: dto.defaultLocale,
        mainImage: dto.mainImage,
        updatedAt: dto.updatedAt ? dayjs(dto.updatedAt).toDate() : new Date(),
      })
      .where(eq(feeds.id, dto.feedId))
      .returning();

    return updatedFeed;
  }
);

export const upsertFeedTranslation = withDTO(
  async (
    db,
    dto: {
      feedId: number;
      locale: Locale;
    } & Partial<InsertFeedTranslationDTO>
  ) => {
    const existingTranslation = await db.query.feedTranslations.findFirst({
      where: {
        feedId: dto.feedId,
        locale: dto.locale,
      },
    });

    if (existingTranslation) {
      const [updated] = await db
        .update(feedTranslations)
        .set({
          title: dto.title,
          excerpt: dto.excerpt,
          description: dto.description,
          summary: dto.summary,
          readTime: dto.readTime,
          embedding: dto.embedding ?? undefined,
          embedding512: dto.embedding512 ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(feedTranslations.id, existingTranslation.id))
        .returning();

      return updated;
    } else {
      const [created] = await db
        .insert(feedTranslations)
        .values({
          feedId: dto.feedId,
          locale: dto.locale,
          title: dto.title ?? "",
          excerpt: dto.excerpt,
          description: dto.description,
          summary: dto.summary,
          readTime: dto.readTime,
          embedding: dto.embedding ?? undefined,
          embedding512: dto.embedding512 ?? undefined,
        })
        .returning();

      return created;
    }
  }
);

export const updateFeedTranslation = withDTO(
  async (
    db,
    dto: {
      translationId: number;
    } & Partial<UpdateFeedTranslationDTO>
  ) => {
    const [updated] = await db
      .update(feedTranslations)
      .set({
        title: dto.title,
        excerpt: dto.excerpt,
        description: dto.description,
        summary: dto.summary,
        readTime: dto.readTime,
        embedding: dto.embedding ?? undefined,
        embedding512: dto.embedding512 ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(feedTranslations.id, dto.translationId))
      .returning();

    return updated;
  }
);

export const upsertContent = withDTO(
  async (
    db,
    dto: {
      feedTranslationId: number;
      content?: string | null;
      source?: string | null;
      unstableSerializedSource?: string | null;
    }
  ) => {
    const existingContent = await db.query.contents.findFirst({
      where: {
        feedTranslationId: dto.feedTranslationId,
      },
    });

    if (existingContent) {
      const [updated] = await db
        .update(contents)
        .set({
          content: dto.content,
          source: dto.source,
          unstableSerializedSource: dto.unstableSerializedSource,
          updatedAt: new Date(),
        })
        .where(eq(contents.id, existingContent.id))
        .returning();

      return updated;
    } else {
      const [created] = await db
        .insert(contents)
        .values({
          feedTranslationId: dto.feedTranslationId,
          content: dto.content,
          source: dto.source,
          unstableSerializedSource: dto.unstableSerializedSource,
        })
        .returning();

      return created;
    }
  }
);

export const deleteFeed = withDTO(async (db, dto: { feedId: number }) => {
  await db.delete(feeds).where(eq(feeds.id, dto.feedId));
});

export const deleteFeedTranslation = withDTO(
  async (db, dto: { translationId: number }) => {
    await db
      .delete(feedTranslations)
      .where(eq(feedTranslations.id, dto.translationId));
  }
);
