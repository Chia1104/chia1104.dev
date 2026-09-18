export interface FakeContentReadPortOptions<
  THit = never,
  TPost extends { slug: string; feedId: number } = {
    slug: string;
    feedId: number;
  },
  TList = never,
  TTag = never,
> {
  searchHits?: THit[];
  posts?: TPost[];
  list?: TList[];
  tags?: TTag[];
}

export const createFakeContentReadPort = <
  THit = never,
  TPost extends { slug: string; feedId: number } = {
    slug: string;
    feedId: number;
  },
  TList = never,
  TTag = never,
>(
  options: FakeContentReadPortOptions<THit, TPost, TList, TTag> = {}
) => ({
  searchPosts: () =>
    Promise.resolve({ hits: options.searchHits ?? [], answerable: null }),
  getPost: (input: { slug?: string; feedId?: number }) =>
    Promise.resolve(
      (options.posts ?? []).find((post) =>
        input.slug !== undefined
          ? post.slug === input.slug
          : post.feedId === input.feedId
      ) ?? null
    ),
  listPosts: () =>
    Promise.resolve({
      posts: options.list ?? [],
      total: options.list?.length ?? 0,
    }),
  listTags: () => Promise.resolve(options.tags ?? []),
});
