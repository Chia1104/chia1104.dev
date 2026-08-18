import type {
  PostListItem,
  PostSearchHit,
  PostSnapshot,
  TagItem,
} from "@chia/agent-content/types";

import type { ContentPort, WebPort } from "../src/ports.ts";
import type {
  CommitDraftInput,
  CommitDraftResult,
  FetchedPage,
  WebSearchInput,
  WebSearchResult,
} from "../src/types.ts";

/** Scriptable {@link ContentPort} for tests. */
export interface FakeContentPortOptions {
  searchHits?: PostSearchHit[];
  posts?: PostSnapshot[];
  list?: PostListItem[];
  tags?: TagItem[];
}

export interface FakeContentPort extends ContentPort {
  readonly commits: CommitDraftInput[];
  readonly publishes: { feedId: number; published: boolean }[];
}

export const createFakeContentPort = (
  options: FakeContentPortOptions = {}
): FakeContentPort => {
  const commits: CommitDraftInput[] = [];
  const publishes: { feedId: number; published: boolean }[] = [];
  let nextFeedId = 100;

  return {
    commits,
    publishes,
    searchPosts: () => Promise.resolve(options.searchHits ?? []),
    getPost: (input) =>
      Promise.resolve(
        (options.posts ?? []).find(
          (post) =>
            (input.slug !== undefined && post.slug === input.slug) ||
            (input.feedId !== undefined && post.feedId === input.feedId)
        ) ?? null
      ),
    listPosts: () => Promise.resolve(options.list ?? []),
    listTags: () => Promise.resolve(options.tags ?? []),
    commitDraft: (input) => {
      commits.push(input);
      const feedId = input.feedId ?? nextFeedId++;
      const result: CommitDraftResult = {
        feedId,
        slug: input.feedMeta.slug ?? `generated-${feedId}`,
        created: input.feedId === undefined,
      };
      return Promise.resolve(result);
    },
    setPublished: (input) => {
      publishes.push({ feedId: input.feedId, published: input.published });
      return Promise.resolve({
        feedId: input.feedId,
        published: input.published,
      });
    },
  };
};

/** Scriptable {@link WebPort} for tests. */
export interface FakeWebPortOptions {
  pages?: Record<string, FetchedPage>;
  results?: WebSearchResult[];
}

export interface FakeWebPort extends WebPort {
  readonly searches: WebSearchInput[];
  /** What every `search` returns; mutable so a test can script it after construction. */
  readonly results: WebSearchResult[];
}

export const createFakeWebPort = (
  options: FakeWebPortOptions = {}
): FakeWebPort => {
  const searches: WebSearchInput[] = [];
  const results: WebSearchResult[] = options.results ?? [];

  return {
    searches,
    results,
    search: (input) => {
      searches.push(input);
      return Promise.resolve([...results]);
    },
    fetchPage: (url) =>
      Promise.resolve(
        options.pages?.[url] ?? { url, title: "Untitled", text: "" }
      ),
  };
};
