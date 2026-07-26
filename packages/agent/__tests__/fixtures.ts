import type { ContentPort } from "../src/ports.ts";
import type {
  CommitDraftInput,
  CommitDraftResult,
  FetchedPage,
  MdxCompileResult,
  PostListItem,
  PostSearchHit,
  PostSnapshot,
  TagItem,
} from "../src/types.ts";

/**
 * Scriptable {@link ContentPort} for tests.
 *
 * `compileMdx` implements a deliberately crude but *real* check — unbalanced JSX and unbalanced
 * code fences — so `validate_draft` can be exercised without pulling the MDX compiler (and React)
 * into a unit test. The production adapter in `apps/service` uses the real pipeline.
 */
export interface FakeContentPortOptions {
  searchHits?: PostSearchHit[];
  posts?: PostSnapshot[];
  list?: PostListItem[];
  tags?: TagItem[];
  pages?: Record<string, FetchedPage>;
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
    compileMdx: (content) => Promise.resolve(fakeCompile(content)),
    fetchPage: (url) =>
      Promise.resolve(
        options.pages?.[url] ?? { url, title: "Untitled", text: "" }
      ),
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

const fakeCompile = (content: string): MdxCompileResult => {
  const withoutFences = content.replace(/```[\s\S]*?```/g, "");

  const opened = [...withoutFences.matchAll(/<([A-Z][A-Za-z0-9]*)(\s[^>]*)?>/g)]
    .filter((match) => !match[0].endsWith("/>"))
    .map((match) => match[1]!);
  const closed = [...withoutFences.matchAll(/<\/([A-Z][A-Za-z0-9]*)>/g)].map(
    (match) => match[1]!
  );

  for (const tag of opened) {
    const index = closed.indexOf(tag);
    if (index === -1) {
      return {
        ok: false,
        message: `Expected a closing tag for <${tag}>`,
      };
    }
    closed.splice(index, 1);
  }

  return { ok: true };
};
