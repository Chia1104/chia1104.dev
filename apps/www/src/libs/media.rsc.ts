import "server-only";
import { ORPCError } from "@orpc/client";
import { getLocale } from "next-intl/server";

import { FeedMode, FeedOrderBy } from "@chia/db/types";
import { wwwFeedCacheTag } from "@chia/utils/config";

import { client } from "@/libs/orpc/client.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";
import { HOBBY_FEED_SEGMENT, isHobbyFeedType } from "@/shared/hobby-feed";
import type { HobbyFeed, HobbyFeedType } from "@/shared/hobby-feed";
import { MEDIA_KIND_SEGMENT } from "@/shared/media";
import type { MediaWork } from "@/shared/media";

/**
 * The work a `/hobby/[kind]/[slug]` URL names, or `null` when there is none. The kind is part of
 * the URL, so a slug under another kind's path is not that work's address.
 */
export const mediaWorkOf = async (
  kindSegment: string,
  slug: string
): Promise<MediaWork | null> => {
  try {
    const work = await client.media.get({ slug });
    return MEDIA_KIND_SEGMENT[work.entry.kind] === kindSegment ? work : null;
  } catch (error) {
    if (error instanceof ORPCError && error.code === "NOT_FOUND") return null;
    throw error;
  }
};

/** One person's hobby writing is bounded, so a list is a cap, not a page. */
const HOBBY_FEED_LIMIT = 200;

/**
 * Published hobby articles that have a body in the reader's language, newest first; narrowed to
 * one type, or to the ones about the work with `media` as its slug.
 */
export const hobbyFeedsOf = async (
  filter: { type?: HobbyFeedType; media?: string } = {}
): Promise<HobbyFeed[]> => {
  const locale = await getLocale();
  const { items } = await client.feeds.list({
    mode: FeedMode.Hobby,
    type: filter.type,
    media: filter.media,
    limit: HOBBY_FEED_LIMIT,
    orderBy: FeedOrderBy.CreatedAt,
    sortOrder: "desc",
    withContent: false,
    locale: dbLocaleResolver(locale),
    translated: true,
  });
  return items;
};

/**
 * The article a `/hobby/[type]/[slug]` URL names with its `locale` translation, or `null` when
 * there is none: an unknown slug, a tech post, another type's path, or no body in that language.
 */
export const hobbyFeedOf = async (
  typeSegment: string,
  slug: string,
  locale: Locale
) => {
  try {
    const feed = await client.feeds["details-by-slug"](
      { slug, locale: dbLocaleResolver(locale) },
      { context: { cacheTags: [wwwFeedCacheTag(slug)] } }
    );
    if (
      !isHobbyFeedType(feed.type) ||
      HOBBY_FEED_SEGMENT[feed.type] !== typeSegment
    ) {
      return null;
    }
    const [translation] = feed.translations;
    return translation?.content
      ? { feed, type: feed.type, translation, content: translation.content }
      : null;
  } catch (error) {
    if (error instanceof ORPCError && error.code === "NOT_FOUND") return null;
    throw error;
  }
};

export type HobbyArticle = NonNullable<Awaited<ReturnType<typeof hobbyFeedOf>>>;
