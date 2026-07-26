import type {
  CommitDraftInput,
  CommitDraftResult,
  ContentPort,
  FetchedPage,
  GetPostInput,
  ListPostsInput,
  MdxCompileResult,
  PostFeedType,
  PostListItem,
  PostSearchHit,
  PostSnapshot,
  SearchPostsInput,
  TagItem,
} from "@chia/agent/ports";
import { CANONICAL_EMBEDDING_MODEL } from "@chia/ai/embeddings/utils";
import { searchFeedsService } from "@chia/api/feeds/search";
import { createFeedService, updateFeedService } from "@chia/api/services/feeds";
import { compileMDX } from "@chia/contents/services";
import type { DB } from "@chia/db";
import {
  getFeedById,
  getFeedBySlug,
  getInfiniteFeeds,
} from "@chia/db/repos/feeds";
import type { ContentType, Locale } from "@chia/db/types";
import {
  ContentType as ContentTypeEnum,
  FeedType as FeedTypeEnum,
} from "@chia/db/types";
import type { Keyv } from "@chia/kv";
import request from "@chia/utils/request";

/**
 * {@link ContentPort} implementation.
 *
 * This is the whole IO surface of the writing agent. It reuses what already exists —
 * `searchFeedsService`, `@chia/db/repos/feeds`, `createFeedService`/`updateFeedService`,
 * `compileMDX` — rather than issuing its own queries, so the agent is subject to the same
 * validation, slug generation and post-write indexing as a human using the dashboard.
 *
 * Takes a `DB` and a `Keyv` rather than a `ServiceContext`, because it is constructed inside a
 * workflow step where no request exists. Authorisation happened at the transport boundary before
 * the run was started; `adminId` is the already-verified result of that, never tool input.
 */

const MAX_PAGE_CHARS = 200_000;

/** Shape the feed write services expect for one locale. */
interface TranslationPayload {
  title: string;
  excerpt: string | null;
  description: string | null;
  summary: string | null;
  content?: { content: string };
}

export interface CreateContentPortOptions {
  db: DB;
  kv: Keyv;
  /** Already verified by `adminGuard` before the workflow run was started. */
  adminId: string;
}

export const createAgentContentPort = (
  options: CreateContentPortOptions
): ContentPort => {
  const { db, kv, adminId } = options;

  return {
    async searchPosts(input: SearchPostsInput): Promise<PostSearchHit[]> {
      const result = await searchFeedsService({
        db,
        kv,
        keyword: input.keyword,
        model: input.mode === "algolia" ? "algolia" : CANONICAL_EMBEDDING_MODEL,
        locale: input.locale,
        // BYO-key clients are for the dashboard's one-shot helpers; the agent uses the
        // server-configured embedding credentials.
        client: undefined,
      });

      if (result.provider === "algolia") {
        return result.items.slice(0, input.limit).map((hit) => ({
          slug: hit.slug,
          locale: hit.locale,
          title: hit.title,
          snippet: hit.description || hit.content.slice(0, 400),
        }));
      }

      return result.items.slice(0, input.limit).map((item) => ({
        slug: item.slug,
        locale: item.locale,
        title: item.title,
        snippet: item.chunkText ?? "",
        headingPath: item.headingPath ?? undefined,
      }));
    },

    async getPost(input: GetPostInput): Promise<PostSnapshot | null> {
      const feed =
        input.feedId !== undefined
          ? await getFeedById(db, {
              feedId: input.feedId,
              locale: input.locale,
              enableDeleted: false,
            })
          : input.slug
            ? await getFeedBySlug(db, {
                slug: input.slug,
                locale: input.locale,
                enableDeleted: false,
              })
            : null;

      if (!feed) return null;
      return toPostSnapshot(feed);
    },

    async listPosts(input: ListPostsInput): Promise<PostListItem[]> {
      const data = await getInfiniteFeeds(db, {
        limit: input.limit,
        cursor: null,
        orderBy: "updatedAt",
        sortOrder: "desc",
        withContent: false,
        enableDeleted: false,
        whereAnd: {
          userId: input.adminId,
          ...(input.published === undefined
            ? {}
            : { published: input.published }),
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
          type: feed.type as PostFeedType,
          published: feed.published,
          defaultLocale: feed.defaultLocale as Locale,
          title: translation?.title ?? "(untitled)",
          updatedAt: new Date(feed.updatedAt).toISOString(),
        };
      });
    },

    /**
     * Read straight from the tag tables.
     *
     * There is no tag repository yet because nothing in the app writes tags — the dashboard only
     * ever joins them onto a feed. A read-only projection is enough for the agent to suggest
     * existing tags instead of inventing near-duplicates.
     */
    async listTags(): Promise<TagItem[]> {
      const rows = await db.query.tags.findMany({
        with: { translations: true },
        limit: 200,
      });
      return rows.map((tag) => ({
        slug: tag.slug,
        names: Object.fromEntries(
          (tag.translations ?? []).map((translation) => [
            translation.locale,
            translation.name,
          ])
        ) as TagItem["names"],
      }));
    },

    /**
     * Compiles with the site's real MDX pipeline, so anything that passes here renders.
     *
     * The compiler throws on failure; the message is handed back to the model verbatim because it
     * names the construct and usually the position, which is exactly what it needs to fix itself.
     */
    async compileMdx(content: string): Promise<MdxCompileResult> {
      try {
        await compileMDX(content);
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const position = error as { line?: number; column?: number };
        return {
          ok: false,
          message,
          line: typeof position.line === "number" ? position.line : undefined,
          column:
            typeof position.column === "number" ? position.column : undefined,
        };
      }
    },

    async fetchPage(url: string): Promise<FetchedPage> {
      const response = await request({
        headers: { Accept: "text/html,application/xhtml+xml" },
      }).get(url);
      const html = (await response.text()).slice(0, MAX_PAGE_CHARS);

      // Dynamic import matches `toolings.route.ts` — jsdom is heavy and only a few routes need it.
      const JSDOM = await import("jsdom").then((module) => module.JSDOM);
      const { document } = new JSDOM(html).window;

      for (const selector of ["script", "style", "noscript", "svg"]) {
        for (const node of document.querySelectorAll(selector)) node.remove();
      }

      const main =
        document.querySelector("article") ??
        document.querySelector("main") ??
        document.body;

      return {
        url,
        title: document.querySelector("title")?.textContent ?? undefined,
        // Collapse the whitespace jsdom preserves; the model does not benefit from blank lines.
        text: (main?.textContent ?? "")
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .join("\n"),
      };
    },

    async commitDraft(input: CommitDraftInput): Promise<CommitDraftResult> {
      // Built with an explicit loop rather than `Object.entries().map()`: the draft's translation
      // map is a `Partial<Record<Locale, …>>`, and entries-then-fromEntries loses the key type.
      const translations: Record<string, TranslationPayload> = {};
      for (const locale of Object.keys(input.translations) as Locale[]) {
        const translation = input.translations[locale];
        if (!translation) continue;
        translations[locale] = {
          title: translation.title ?? "",
          excerpt: translation.excerpt ?? null,
          description: translation.description ?? null,
          summary: translation.summary ?? null,
          ...(translation.content === undefined
            ? {}
            : { content: { content: translation.content } }),
        };
      }

      if (input.adminId !== adminId) {
        // Defence in depth: the tool context is built per turn, and a mismatch here would mean it
        // was constructed for a different operator than the request was authorised for.
        throw new Error("Agent tool context admin does not match the request.");
      }

      if (input.feedId === undefined) {
        const created = await createFeedService(db, {
          adminId,
          slug: input.feedMeta.slug,
          type: input.feedMeta.type ?? FeedTypeEnum.Post,
          contentType: input.feedMeta.contentType ?? ContentTypeEnum.Mdx,
          defaultLocale: input.feedMeta.defaultLocale,
          mainImage: input.feedMeta.mainImage ?? undefined,
          // Never published on commit — publishing is separately approved.
          published: false,
          translations,
        });
        if (!created) {
          throw new Error("Creating the feed returned no row.");
        }
        return { feedId: created.id, slug: created.slug, created: true };
      }

      const updated = await updateFeedService(db, {
        feedId: input.feedId,
        type: input.feedMeta.type,
        contentType: input.feedMeta.contentType,
        defaultLocale: input.feedMeta.defaultLocale,
        mainImage: input.feedMeta.mainImage ?? undefined,
        translations,
      });
      return { feedId: updated.id, slug: updated.slug, created: false };
    },

    async setPublished(input) {
      if (input.adminId !== adminId) {
        throw new Error("Agent tool context admin does not match the request.");
      }
      const updated = await updateFeedService(db, {
        feedId: input.feedId,
        published: input.published,
      });
      return { feedId: updated.id, published: updated.published };
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
        content?: { content?: string | null } | null;
      }[]
    | null;
  feedsToTags?: { tag?: { slug: string } | null }[] | null;
}): PostSnapshot => ({
  feedId: feed.id,
  slug: feed.slug,
  type: feed.type as PostFeedType,
  contentType: feed.contentType as ContentType,
  published: feed.published,
  defaultLocale: feed.defaultLocale as Locale,
  mainImage: feed.mainImage,
  translations: (feed.translations ?? []).map((translation) => ({
    locale: translation.locale as Locale,
    title: translation.title,
    excerpt: translation.excerpt,
    description: translation.description,
    summary: translation.summary,
    content: translation.content?.content ?? null,
  })),
  tagSlugs: (feed.feedsToTags ?? [])
    .map((relation) => relation.tag?.slug)
    .filter((slug): slug is string => typeof slug === "string"),
});
