import type {
  ContentReadPort,
  PostListItem,
  PostSearchHit,
  PostSnapshot,
  FetchedPage,
  TagItem,
  WebPort,
  WebSearchInput,
  WebSearchResult,
} from "@chia/agent-content/types";
import { AgentProvider } from "@chia/agent-runtime/models";
import type { AgentCatalog, AgentModel } from "@chia/agent-runtime/models";
import { createFakeContentReadPort } from "@chia/test/fixtures/content-read-port";

import { DEFAULT_WRITING_MODEL } from "../src/models.ts";
import type { ContentPort, GitHubPort } from "../src/ports.ts";
import type {
  CommitDraftResult,
  GitHubRef,
  GitHubTreeEntry,
} from "../src/types.ts";

export interface FakeContentPortOptions {
  searchHits?: PostSearchHit[];
  posts?: PostSnapshot[];
  list?: PostListItem[];
  tags?: TagItem[];
}

export interface FakeContentPort extends ContentPort {
  readonly commits: {
    draftId: number;
    expectedHash: string;
    message: string;
  }[];
  readonly publishes: { feedId: number; published: boolean }[];
  /** Runs after each `applyDraft`, so a test can bind its in-memory draft to the new feed. */
  onApplied?: (result: CommitDraftResult) => void;
}

export const createFakeContentPort = (
  options: FakeContentPortOptions = {}
): FakeContentPort => {
  const read: ContentReadPort = createFakeContentReadPort(options);
  const commits: FakeContentPort["commits"] = [];
  const publishes: { feedId: number; published: boolean }[] = [];
  let nextFeedId = 100;

  const port: FakeContentPort = {
    ...read,
    commits,
    publishes,
    applyDraft: (input) => {
      commits.push(input);
      const feedId = nextFeedId++;
      const result: CommitDraftResult = {
        feedId,
        slug: `generated-${feedId}`,
        created: true,
      };
      port.onApplied?.(result);
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
  return port;
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

export interface FakeGitHubPortOptions {
  /** Keyed `repo` → ref; `sha` defaults to a fixed value. */
  refs?: Record<string, Partial<GitHubRef>>;
  /** Keyed `repo/path` → file text. */
  files?: Record<string, string>;
  /** Keyed `repo/path` (empty path for the root) → entries. */
  trees?: Record<string, GitHubTreeEntry[]>;
}

export interface FakeGitHubPort extends GitHubPort {
  readonly calls: { method: keyof GitHubPort; input: unknown }[];
  readonly signals: (AbortSignal | undefined)[];
}

const FAKE_SHA = "0123456789abcdef0123456789abcdef01234567";

export const createFakeGitHubPort = (
  options: FakeGitHubPortOptions = {}
): FakeGitHubPort => {
  const calls: FakeGitHubPort["calls"] = [];
  const signals: (AbortSignal | undefined)[] = [];

  const refOf = (repo: string, ref: string | undefined): GitHubRef => {
    const known = options.refs?.[repo];
    const defaultBranch = known?.defaultBranch ?? "main";
    return {
      repo,
      ref: ref ?? defaultBranch,
      sha: FAKE_SHA,
      defaultBranch,
      url: `https://github.com/${repo}`,
      description: null,
      private: false,
      ...known,
    };
  };

  return {
    calls,
    signals,
    resolveRef(input, signal) {
      calls.push({ method: "resolveRef", input });
      signals.push(signal);
      return Promise.resolve(refOf(input.repo, input.ref));
    },
    listTree(input, signal) {
      calls.push({ method: "listTree", input });
      signals.push(signal);
      const key = input.path ? `${input.repo}/${input.path}` : input.repo;
      return Promise.resolve({
        ref: refOf(input.repo, input.ref),
        path: input.path ?? "",
        entries: options.trees?.[key] ?? [],
        truncated: false,
      });
    },
    readFile(input, signal) {
      calls.push({ method: "readFile", input });
      signals.push(signal);
      const text = options.files?.[`${input.repo}/${input.path}`];
      if (text === undefined) {
        return Promise.reject(
          new Error(`${input.repo}/${input.path} was not found on GitHub.`)
        );
      }
      const ref = refOf(input.repo, input.ref);
      return Promise.resolve({
        ref,
        path: input.path,
        blobSha: "blob".padEnd(40, "0"),
        size: Buffer.byteLength(text),
        text,
        url: `${ref.url}/blob/${ref.sha}/${input.path}`,
      });
    },
  };
};

/** A catalogue row with no prices; only identity and capabilities matter to policy. */
export const catalogModel = (
  providerId: string,
  modelId: string,
  overrides: Partial<AgentModel> = {}
): AgentModel => ({
  providerId,
  modelId,
  name: modelId,
  contextWindow: 200_000,
  reasoningEfforts: null,
  supportsTemperature: true,
  input: ["text"],
  pricing: { input: [], output: [], cacheRead: [], cacheWrite: [] },
  ...overrides,
});

/** Both admitted gateway vendors, one the writing policy refuses, and both native providers. */
export const WRITING_CATALOG: AgentCatalog = {
  models: [
    catalogModel(AgentProvider.Gateway, DEFAULT_WRITING_MODEL.modelId),
    catalogModel(AgentProvider.Gateway, "anthropic/claude-sonnet-5"),
    catalogModel(AgentProvider.Gateway, "openai/gpt-5.4"),
    catalogModel(AgentProvider.Gateway, "google/gemini-3.1-pro"),
    catalogModel(AgentProvider.OpenAI, "gpt-5.2"),
    catalogModel(AgentProvider.Anthropic, "claude-sonnet-5"),
    catalogModel(AgentProvider.Anthropic, "claude-opus-5"),
  ],
};
