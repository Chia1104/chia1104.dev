import type {
  ContentReadPort,
  GetPostInput,
  ListPostsInput,
  PostFeedType,
  PostList,
  PostListItem,
  PostSearchResult,
  PostSnapshot,
  SearchPostsInput,
  TagItem,
} from "@chia/agent-content/types";
import type { DB } from "@chia/db/client";
import {
  countFeeds,
  getFeedById,
  getFeedBySlug,
  getInfiniteFeeds,
} from "@chia/db/repos/feeds";
import { listTags } from "@chia/db/repos/tags";
import { FeedOrderBy, FeedType, Locale } from "@chia/db/types";
import { feedUrl } from "@chia/utils/config";

import { searchFeedsService } from "../feeds/search.service";
import { ResourceSearchMode } from "../rag/resource-types";
import { toSearchMatches } from "../rag/search.service";

/**
 * Reuses `searchFeedsService` and `@chia/db/repos/feeds` so an agent reads exactly what
 * the site reads. Takes a `DB` because it is constructed inside a workflow step where no
 * request exists. Visibility is fixed at construction: `public` never lists drafts even
 * when asked.
 */

export const ContentVisibility = {
  Author: "author",
  Public: "public",
} as const;

export type ContentVisibility =
  (typeof ContentVisibility)[keyof typeof ContentVisibility];

export interface CreateContentReadPortOptions {
  db: DB;
  /** Whose posts are listed. The site has one author, so both visibilities scope to them. */
  authorId: string;
  visibility: ContentVisibility;
}

export const createContentReadPort = (
  options: CreateContentReadPortOptions
): ContentReadPort => {
  const { db, authorId, visibility } = options;
  /** `undefined` means "any"; the repositories treat it as no filter. */
  const publishedScope =
    visibility === ContentVisibility.Public ? true : undefined;

  return {
    async searchPosts(input: SearchPostsInput): Promise<PostSearchResult> {
      const result = await searchFeedsService({
        db,
        keyword: input.keyword,
        // `keyword` is in-database BM25; `semantic` fuses dense and lexical because a
        // document vector alone under-recalls exact terms (package names, CLI flags).
        model:
          input.mode === "keyword"
            ? ResourceSearchMode.Bm25
            : ResourceSearchMode.Hybrid,
        locale: input.locale,
        includeUnpublished: publishedScope === undefined,
        limit: input.limit,
        rerank: true,
      });

      return {
        hits: result.items.slice(0, input.limit).map((item) => {
          const locale = item.summary.locale ?? Locale.ZhTW;
          return {
            slug: item.slug,
            locale,
            url: feedUrl({ type: item.type, slug: item.slug, locale }),
            title: item.summary.title,
            matches: toSearchMatches(item.chunks),
          };
        }),
        answerable: result.answerable ?? null,
      };
    },

    async getPost(input: GetPostInput): Promise<PostSnapshot | null> {
      const feed =
        input.slug !== undefined
          ? await getFeedBySlug(db, {
              slug: input.slug,
              locale: input.locale,
              enableDeleted: false,
              userId: authorId,
              published: publishedScope,
            })
          : await getFeedById(db, {
              feedId: input.feedId,
              locale: input.locale,
              enableDeleted: false,
              userId: authorId,
              published: publishedScope,
            });

      if (!feed) return null;
      return toPostSnapshot(feed);
    },

    async listPosts(input: ListPostsInput): Promise<PostList> {
      // A public view has no drafts. Answer without a query so the reader learns "none"
      // rather than a filter being silently overridden.
      if (publishedScope === true && input.published === false) {
        return { posts: [], total: 0 };
      }

      const published = input.published ?? publishedScope;
      const type = input.type ?? FeedType.All;
      const createdFrom = input.createdFrom
        ? new Date(input.createdFrom)
        : undefined;
      const createdBefore = input.createdBefore
        ? new Date(input.createdBefore)
        : undefined;

      // Sequential: both may run on a transaction's single connection.
      const data = await getInfiniteFeeds(db, {
        limit: input.limit,
        cursor: null,
        orderBy: FeedOrderBy.CreatedAt,
        sortOrder: "desc",
        type,
        tagSlug: input.tagSlug,
        withContent: false,
        enableDeleted: false,
        whereAnd: {
          userId: authorId,
          published,
          createdAt:
            createdFrom || createdBefore
              ? { gte: createdFrom, lt: createdBefore }
              : undefined,
        },
      });
      const total = await countFeeds(db, {
        userId: authorId,
        published,
        type,
        tagSlug: input.tagSlug,
        createdFrom,
        createdBefore,
      });

      const posts = (data?.items ?? []).map((feed): PostListItem => {
        const translation =
          feed.translations?.find(
            (candidate) => candidate.locale === feed.defaultLocale
          ) ?? feed.translations?.[0];
        return {
          feedId: feed.id,
          slug: feed.slug,
          url: feedUrl({
            type: feed.type,
            slug: feed.slug,
            locale: feed.defaultLocale,
          }),
          type: feed.type,
          published: feed.published,
          defaultLocale: feed.defaultLocale,
          title: translation?.title ?? "(untitled)",
          createdAt: new Date(feed.createdAt).toISOString(),
          updatedAt: new Date(feed.updatedAt).toISOString(),
        };
      });
      return { posts, total };
    },

    async listTags(): Promise<TagItem[]> {
      const rows = await listTags(db);
      return rows.map((tag) => {
        const names: TagItem["names"] = {};
        for (const locale of Object.values(Locale)) {
          const translation = tag.translations[locale];
          if (translation) names[locale] = translation.name;
        }
        return { slug: tag.slug, names };
      });
    },
  };
};

/** Maps the repository's feed shape onto the agent's flattened snapshot. */
const toPostSnapshot = (feed: {
  id: number;
  slug: string;
  type: PostFeedType;
  published: boolean;
  defaultLocale: Locale;
  mainImage?: string | null;
  translations?:
    | {
        locale: Locale;
        title: string;
        excerpt?: string | null;
        description?: string | null;
        summary?: string | null;
        content?: string | null;
      }[]
    | null;
  tags?: { slug: string }[] | null;
}): PostSnapshot => ({
  feedId: feed.id,
  slug: feed.slug,
  url: feedUrl({
    type: feed.type,
    slug: feed.slug,
    locale: feed.defaultLocale,
  }),
  type: feed.type,
  published: feed.published,
  defaultLocale: feed.defaultLocale,
  mainImage: feed.mainImage,
  translations: (feed.translations ?? []).map((translation) => ({
    locale: translation.locale,
    url: feedUrl({
      type: feed.type,
      slug: feed.slug,
      locale: translation.locale,
    }),
    title: translation.title,
    excerpt: translation.excerpt,
    description: translation.description,
    summary: translation.summary,
    content: translation.content ?? null,
  })),
  tagSlugs: (feed.tags ?? []).map((tag) => tag.slug),
});
