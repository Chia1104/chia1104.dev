import crypto from "node:crypto";

import {
  getInfiniteFeeds,
  getInfiniteFeedsByUserId,
  getFeedBySlug,
  getFeedById,
  createFeed,
  updateFeed,
  upsertFeedTranslation,
  upsertContent,
  deleteFeed,
} from "@chia/db/repos/feeds";
import { ContentType, Locale } from "@chia/db/types";

import { adminGuard } from "../guards/admin.guard";
import { authGuard } from "../guards/auth.guard";
import { contractOS, slugger } from "../utils";

export const getFeedsWithMetaRoute = contractOS.feeds.list
  .use(authGuard)
  .handler(async (opts) => {
    const data = await getInfiniteFeeds(opts.context.db, {
      ...opts.input,
      whereAnd: { userId: opts.context.session.user.id ?? "" },
    });
    if (!data) {
      throw opts.errors.NOT_FOUND();
    }
    return data;
  });

export const getFeedsWithMetaByAdminIdRoute = contractOS.feeds["admin-list"]
  .use(
    adminGuard({
      enabled: false,
    })
  )
  .handler(async (opts) => {
    const data = await getInfiniteFeedsByUserId(opts.context.db, {
      ...opts.input,
      userId: opts.context.adminId,
      whereAnd: { published: true },
    });
    if (!data) {
      throw opts.errors.NOT_FOUND();
    }
    return data;
  });

export const getFeedBySlugRoute = contractOS.feeds["details-by-slug"]
  .use(authGuard)
  .handler(async (opts) => {
    const data = await getFeedBySlug(opts.context.db, {
      slug: opts.input.slug,
      locale: opts.input.locale,
    });
    if (!data) {
      throw opts.errors.NOT_FOUND();
    }
    return data;
  });

export const getFeedByIdRoute = contractOS.feeds["details-by-id"]
  .use(authGuard)
  .handler(async (opts) => {
    const data = await getFeedById(opts.context.db, {
      feedId: opts.input.feedId,
      locale: opts.input.locale,
    });
    if (!data) {
      throw opts.errors.NOT_FOUND();
    }
    return data;
  });

export const createFeedRoute = contractOS.feeds.create
  .use(adminGuard())
  .handler(async (opts) => {
    const defaultTranslation = opts.input.translations[Locale.zhTW];
    if (!defaultTranslation) {
      throw opts.errors.BAD_REQUEST({
        message: "No default translation provided",
      });
    }
    const data = await createFeed(opts.context.db, {
      slug: opts.input.slug
        ? slugger.slug(opts.input.slug)
        : slugger.slug(
            `${defaultTranslation.title}-${crypto.getRandomValues(new Uint32Array(1))[0]?.toString(16)}`
          ),
      type: opts.input.type,
      userId: opts.context.adminId,
      published: opts.input.published ?? false,
      contentType: opts.input.contentType ?? ContentType.Mdx,
      defaultLocale: opts.input.defaultLocale ?? Locale.zhTW,
      mainImage: opts.input.mainImage ?? null,
      createdAt: opts.input.createdAt,
      updatedAt: opts.input.updatedAt,
      translations: Object.entries(opts.input.translations).map(
        ([locale, translation]) => ({
          ...translation,
          locale: locale as Locale,
          content: translation.content ?? {
            content: null,
            source: null,
            unstableSerializedSource: null,
          },
        })
      ),
    });

    if (opts.context.hooks?.onFeedCreated && data) {
      await opts.context.hooks.onFeedCreated(data);
    }

    return data;
  });

export const updateFeedRoute = contractOS.feeds.update
  .use(adminGuard())
  .handler(async (opts) => {
    const feedData = await updateFeed(opts.context.db, {
      feedId: opts.input.feedId,
      type: opts.input.type,
      published: opts.input.published,
      contentType: opts.input.contentType,
      defaultLocale: opts.input.defaultLocale,
      mainImage: opts.input.mainImage,
      createdAt: opts.input.createdAt,
      updatedAt: opts.input.updatedAt,
    });

    if (!feedData) {
      throw opts.errors.NOT_FOUND();
    }

    const translationsData = [];
    const contentsData = [];

    const translations = opts.input.translations;
    if (translations) {
      for (const [locale, translation] of Object.entries(translations)) {
        const translationData = await upsertFeedTranslation(opts.context.db, {
          feedId: opts.input.feedId,
          locale: locale as Locale,
          title: translation.title,
          excerpt: translation.excerpt ?? null,
          description: translation.description ?? null,
          summary: translation.summary ?? null,
          readTime: translation.readTime ?? null,
        });

        if (translationData) {
          translationsData.push(translationData);

          const content = translation.content;
          if (content && translationData.id) {
            const contentData = await upsertContent(opts.context.db, {
              feedTranslationId: translationData.id,
              content: content.content ?? null,
              source: content.source ?? null,
              unstableSerializedSource:
                content.unstableSerializedSource ?? null,
            });

            if (contentData) {
              contentsData.push(contentData);
            }
          }
        }
      }
    }

    const updatedFeed = {
      ...feedData,
      translations: translationsData,
      contents: contentsData,
    };

    if (opts.context.hooks?.onFeedUpdated && updatedFeed) {
      await opts.context.hooks.onFeedUpdated(updatedFeed);
    }

    return updatedFeed;
  });

export const deleteFeedRoute = contractOS.feeds.delete
  .use(adminGuard())
  .handler(async (opts) => {
    await deleteFeed(opts.context.db, {
      feedId: opts.input.feedId,
    });
  });
