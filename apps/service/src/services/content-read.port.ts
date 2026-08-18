import type {
  ContentReadPort,
  GetPostInput,
  ListPostsInput,
  PostFeedType,
  PostListItem,
  PostSearchHit,
  PostSnapshot,
  SearchPostsInput,
  TagItem,
} from "@chia/agent-content/types";
import { searchFeedsService } from "@chia/api/feeds/search";
import type { DB } from "@chia/db/client";
import {
  getFeedById,
  getFeedBySlug,
  getInfiniteFeeds,
} from "@chia/db/repos/feeds";
import type { ContentType, Locale } from "@chia/db/types";

/**
 * {@link ContentReadPort} implementation.
 *
 * Reuses `searchFeedsService` and `@chia/db/repos/feeds` rather than issuing its own queries, so
 * an agent reads exactly what the site and dashboard read. Takes a `DB` rather than a
 * `ServiceContext` because it is constructed inside a workflow step where no request exists.
 *
 * **Visibility is fixed at construction.** `author` sees the configured author's drafts as well;
 * `public` sees only published posts, and its `listPosts` cannot be talked into drafts — asking for
 * them returns nothing rather than widening the view. Search needs no branch: the chunk index is
 * published-only for every caller.
 */

export type ContentVisibility = "author" | "public";

export interface CreateContentReadPortOptions {
  db: DB;
  /** Whose posts are listed. The site has one author, so both visibilities scope to them. */
  authorId: string;
  visibility: ContentVisibility;
}

/**
 * BM25 snippets come back with `<b>` markers for UI highlighting; the agent
 * reads them as prose, so strip the markup rather than leaking it into a prompt.
 */
const stripHighlight = (snippet: string | null): string =>
  snippet?.replaceAll(/<\/?b>/g, "") ?? "";

/** A chunk is up to ~512 tokens; a search hit only needs enough to orient. */
const SNIPPET_MAX_CHARS = 500;

const truncateSnippet = (content: string): string =>
  content.length <= SNIPPET_MAX_CHARS
    ? content
    : `${content.slice(0, SNIPPET_MAX_CHARS)}…`;

export const createContentReadPort = (
  options: CreateContentReadPortOptions
): ContentReadPort => {
  const { db, authorId, visibility } = options;
  /** `undefined` means "any"; the repositories treat it as no filter. */
  const publishedScope = visibility === "public" ? true : undefined;

  return {
    async searchPosts(input: SearchPostsInput): Promise<PostSearchHit[]> {
      const result = await searchFeedsService({
        db,
        keyword: input.keyword,
        // `keyword` is in-database BM25; `semantic` fuses dense and lexical,
        // because a single document vector alone under-recalls exact terms
        // (package names, CLI flags, error messages)
        model: input.mode === "keyword" ? "bm25" : "hybrid",
        locale: input.locale,
        limit: input.limit,
      });

      return result.items.slice(0, input.limit).map((item) => ({
        slug: item.slug,
        locale:
          /* SAFETY: The producer contract guarantees this value satisfies Locale. */ (item
            .summary.locale ?? "zh-TW") as Locale,
        title: item.summary.title,
        // hybrid hits carry no highlighted snippet (ParadeDB cannot combine
        // one with the fused query), so fall back to the matched chunk's own
        // text before the generic description — the agent needs to see *why*
        // a post matched, not just that it did
        snippet:
          stripHighlight(item.bestChunk.snippet) ||
          truncateSnippet(item.bestChunk.content) ||
          item.summary.description ||
          "",
        headingPath: item.bestChunk.headingPath ?? undefined,
      }));
    },

    async getPost(input: GetPostInput): Promise<PostSnapshot | null> {
      const feed =
        input.feedId !== undefined
          ? await getFeedById(db, {
              feedId: input.feedId,
              locale: input.locale,
              enableDeleted: false,
              userId: authorId,
              published: publishedScope,
            })
          : input.slug
            ? await getFeedBySlug(db, {
                slug: input.slug,
                locale: input.locale,
                enableDeleted: false,
                userId: authorId,
                published: publishedScope,
              })
            : null;

      if (!feed) return null;
      return toPostSnapshot(feed);
    },

    async listPosts(input: ListPostsInput): Promise<PostListItem[]> {
      // A public view has no drafts to list. Answer without a query so the reader learns the
      // truth ("none") rather than a filter being silently overridden.
      if (publishedScope === true && input.published === false) return [];

      const published = input.published ?? publishedScope;

      const data = await getInfiniteFeeds(db, {
        limit: input.limit,
        cursor: null,
        orderBy: "updatedAt",
        sortOrder: "desc",
        withContent: false,
        enableDeleted: false,
        whereAnd: {
          userId: authorId,
          published,
        },
      });

      return (data?.items ?? []).map((feed) => {
        const translation =
          feed.translations?.find(
            (candidate) => candidate.locale === feed.defaultLocale
          ) ?? feed.translations?.[0];
        return {
          feedId: feed.id,
          slug: feed.slug,
          type: /* SAFETY: The producer contract guarantees this value satisfies PostFeedType. */ feed.type as PostFeedType,
          published: feed.published,
          defaultLocale:
            /* SAFETY: The producer contract guarantees this value satisfies Locale. */ feed.defaultLocale as Locale,
          title: translation?.title ?? "(untitled)",
          updatedAt: new Date(feed.updatedAt).toISOString(),
        };
      });
    },

    /**
     * Read straight from the tag tables.
     *
     * There is no tag repository yet because nothing in the app writes tags — the dashboard only
     * ever joins them onto a feed. A read-only projection is enough for an agent to name existing
     * tags instead of inventing near-duplicates.
     */
    async listTags(): Promise<TagItem[]> {
      const rows = await db.query.tags.findMany({
        with: { translations: true },
        limit: 200,
      });
      return rows.map((tag) => ({
        slug: tag.slug,
        names:
          /* SAFETY: The producer contract guarantees this value satisfies TagItem["names"]. */ Object.fromEntries(
            (tag.translations ?? []).map((translation) => [
              translation.locale,
              translation.name,
            ])
          ) as TagItem["names"],
      }));
    },
  };
};

/** Maps the repository's feed shape onto the agent's flattened snapshot. */
const toPostSnapshot = (feed: {
  id: number;
  slug: string;
  type: string;
  contentType: string;
  published: boolean;
  defaultLocale: string;
  mainImage?: string | null;
  translations?:
    | {
        locale: string;
        title: string;
        excerpt?: string | null;
        description?: string | null;
        summary?: string | null;
        content?: string | null;
      }[]
    | null;
  feedsToTags?: { tag?: { slug: string } | null }[] | null;
}): PostSnapshot => ({
  feedId: feed.id,
  slug: feed.slug,
  type: /* SAFETY: The producer contract guarantees this value satisfies PostFeedType. */ feed.type as PostFeedType,
  contentType:
    /* SAFETY: The producer contract guarantees this value satisfies ContentType. */ feed.contentType as ContentType,
  published: feed.published,
  defaultLocale:
    /* SAFETY: The producer contract guarantees this value satisfies Locale. */ feed.defaultLocale as Locale,
  mainImage: feed.mainImage,
  translations: (feed.translations ?? []).map((translation) => ({
    locale:
      /* SAFETY: The producer contract guarantees this value satisfies Locale. */ translation.locale as Locale,
    title: translation.title,
    excerpt: translation.excerpt,
    description: translation.description,
    summary: translation.summary,
    content: translation.content ?? null,
  })),
  tagSlugs: (feed.feedsToTags ?? [])
    .map((relation) => relation.tag?.slug)
    .filter((slug): slug is string => slug !== undefined),
});
