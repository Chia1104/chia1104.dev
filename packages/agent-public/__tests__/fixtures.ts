import type {
  ContentReadPort,
  PostListItem,
  PostSearchHit,
  PostSnapshot,
  TagItem,
} from "@chia/agent-content/types";

/** Scriptable {@link ContentReadPort} for tests. */
export interface FakeContentPortOptions {
  searchHits?: PostSearchHit[];
  posts?: PostSnapshot[];
  list?: PostListItem[];
  tags?: TagItem[];
}

export const createFakeContentPort = (
  options: FakeContentPortOptions = {}
): ContentReadPort => ({
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
});
