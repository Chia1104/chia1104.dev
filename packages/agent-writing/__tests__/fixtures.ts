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
        (options.posts ?? []).find((post) =>
          input.slug !== undefined
            ? post.slug === input.slug
            : post.feedId === input.feedId
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

export interface FakeWebPortOptions {
  pages?: Record<string, FetchedPage>;
  results?: WebSearchResult[];
}

export interface FakeWebPort extends WebPort {
  readonly searches: WebSearchInput[];
  readonly signals: (AbortSignal | undefined)[];
  readonly results: WebSearchResult[];
}

export const createFakeWebPort = (
  options: FakeWebPortOptions = {}
): FakeWebPort => {
  const searches: WebSearchInput[] = [];
  const signals: (AbortSignal | undefined)[] = [];
  const results: WebSearchResult[] = options.results ?? [];

  return {
    searches,
    signals,
    results,
    search: (input, signal) => {
      searches.push(input);
      signals.push(signal);
      return Promise.resolve([...results]);
    },
    fetchPage: (url, signal) => {
      signals.push(signal);
      return Promise.resolve(
        options.pages?.[url] ?? { url, title: "Untitled", text: "" }
      );
    },
  };
};
