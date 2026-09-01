import type { AgentTool } from "@chia/agent-runtime/types";
import type { ContentType, FeedType, Locale } from "@chia/db/types";

/**
 * `FeedType` includes `"all"`, which is a filter value rather than a storable one. A real post
 * is only ever `post` or `note`.
 */
export type PostFeedType = Exclude<FeedType, "all">;

export interface PostSearchHit {
  slug: string;
  locale: Locale;
  title: string;
  /** Best-matching fragment: a BM25 snippet, or the summary when there is none. */
  snippet: string;
  /** Heading trail of the matched chunk, as stored, e.g. `"Setup > Install"`. */
  headingPath?: string;
}

export interface PostListItem {
  feedId: number;
  slug: string;
  type: PostFeedType;
  published: boolean;
  defaultLocale: Locale;
  title: string;
  updatedAt: string;
}

export interface PostSnapshot {
  feedId: number;
  slug: string;
  type: PostFeedType;
  contentType: ContentType;
  published: boolean;
  defaultLocale: Locale;
  mainImage?: string | null;
  translations: {
    locale: Locale;
    title: string;
    excerpt?: string | null;
    description?: string | null;
    summary?: string | null;
    content?: string | null;
  }[];
  tagSlugs: string[];
}

export interface TagItem {
  slug: string;
  names: Partial<Record<Locale, string>>;
}

export interface SearchPostsInput {
  keyword: string;
  locale?: Locale;
  /** `keyword` is lexical (BM25); `semantic` fuses dense retrieval with it. */
  mode: "keyword" | "semantic";
  limit: number;
}

interface GetPostInputBase {
  locale?: Locale;
}

export type GetPostInput =
  | (GetPostInputBase & { slug: string; feedId?: never })
  | (GetPostInputBase & { slug?: never; feedId: number });

export interface ListPostsInput {
  limit: number;
  /** `true` for published only, `false` for drafts only. Omit for everything the port can see. */
  published?: boolean;
}

/**
 * Read access to the content domain. Visibility is a property of the implementation, not of a
 * call: tools cannot widen what their port shows them.
 */
export interface ContentReadPort {
  searchPosts(input: SearchPostsInput): Promise<PostSearchHit[]>;
  getPost(input: GetPostInput): Promise<PostSnapshot | null>;
  listPosts(input: ListPostsInput): Promise<PostListItem[]>;
  listTags(): Promise<TagItem[]>;
}

export interface ContentToolContext {
  content: ContentReadPort;
}

export type ContentTool = AgentTool<ContentToolContext>;
