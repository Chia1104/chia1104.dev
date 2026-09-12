import ky, { HTTPError } from "ky";
import type { KyInstance } from "ky";
import * as z from "zod";

/**
 * Repository reads over the REST API: repository metadata, ref resolution, directory and
 * tree listings and file blobs. Takes its token as an option, not from env: the caller owns
 * the credential and its scope, and the client never widens it.
 */

const DEFAULT_BASE_URL = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 30_000;
const API_VERSION = "2022-11-28";

export class GitHubApiError extends Error {
  constructor(
    readonly status: number,
    readonly operation: string,
    options?: { cause?: unknown }
  ) {
    super(`GitHub ${operation} failed (HTTP ${status}).`, options);
    this.name = "GitHubApiError";
  }
}

export interface GitHubSourceClientOptions {
  token: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Injected by tests; ky's own signature, so a mock needs no assertion. */
  fetch?: (
    input: string | URL | Request,
    init?: RequestInit
  ) => Promise<Response>;
}

export interface GitHubRepository {
  /** `owner/name` as GitHub spells it. */
  fullName: string;
  defaultBranch: string;
  private: boolean;
  description: string | null;
  htmlUrl: string;
}

export type GitHubContentType = "file" | "dir" | "symlink" | "submodule";

export interface GitHubContentEntry {
  name: string;
  path: string;
  type: GitHubContentType;
  size: number;
  sha: string;
}

export interface GitHubFileContent {
  path: string;
  sha: string;
  size: number;
  /**
   * Decoded bytes. Empty when the API withheld the body, which it does above 1 MB; check
   * `size` before trusting an empty buffer.
   */
  content: Buffer;
  htmlUrl: string;
}

export interface GitHubTreeEntry {
  path: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
}

export interface GitHubTree {
  sha: string;
  entries: GitHubTreeEntry[];
  /** The API caps a recursive listing; a truncated tree is a prefix, not an error. */
  truncated: boolean;
}

/** What a path holds at a ref; symlinks and submodules have no readable body here. */
export type GitHubContents =
  | { kind: "file"; file: GitHubFileContent }
  | { kind: "dir"; entries: GitHubContentEntry[] }
  | { kind: "other"; type: "symlink" | "submodule"; path: string };

export interface GitHubSourceClient {
  getRepository(repo: string, signal?: AbortSignal): Promise<GitHubRepository>;
  /** The commit sha a branch, tag or sha names. */
  resolveCommit(
    input: { repo: string; ref: string },
    signal?: AbortSignal
  ): Promise<string>;
  getContents(
    input: { repo: string; path: string; ref: string },
    signal?: AbortSignal
  ): Promise<GitHubContents>;
  getTree(
    input: { repo: string; sha: string; recursive: boolean },
    signal?: AbortSignal
  ): Promise<GitHubTree>;
}

const repositorySchema = z.object({
  full_name: z.string(),
  default_branch: z.string(),
  private: z.boolean(),
  description: z.string().nullable(),
  html_url: z.string(),
});

const contentTypeSchema = z.enum(["file", "dir", "symlink", "submodule"]);

const contentEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: contentTypeSchema,
  size: z.number(),
  sha: z.string(),
});

const fileContentSchema = z.object({
  type: z.literal("file"),
  path: z.string(),
  sha: z.string(),
  size: z.number(),
  encoding: z.string().optional(),
  content: z.string().optional(),
  html_url: z.string(),
});

const contentsSchema = z.union([
  z.array(contentEntrySchema),
  fileContentSchema,
  z.object({ type: z.enum(["symlink", "submodule"]), path: z.string() }),
]);

const treeSchema = z.object({
  sha: z.string(),
  truncated: z.boolean(),
  tree: z.array(
    z.object({
      path: z.string(),
      type: z.enum(["blob", "tree", "commit"]),
      sha: z.string(),
      size: z.number().optional(),
    })
  ),
});

const encodePath = (path: string): string =>
  path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(encodeURIComponent)
    .join("/");

const request = async <TValue>(
  http: KyInstance,
  operation: string,
  run: () => Promise<TValue>
): Promise<TValue> => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof HTTPError) {
      throw new GitHubApiError(error.response.status, operation, {
        cause: error,
      });
    }
    throw error;
  }
};

export const createGitHubSourceClient = (
  options: GitHubSourceClientOptions
): GitHubSourceClient => {
  const http = ky.create({
    baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    fetch: options.fetch,
    retry: 0,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${options.token}`,
      "user-agent": "chia1104.dev-writing-agent",
      "x-github-api-version": API_VERSION,
    },
  });

  return {
    async getRepository(repo, signal) {
      const data = await request(http, "repository lookup", () =>
        http.get(`repos/${repo}`, { signal }).json()
      );
      const parsed = repositorySchema.parse(data);
      return {
        fullName: parsed.full_name,
        defaultBranch: parsed.default_branch,
        private: parsed.private,
        description: parsed.description,
        htmlUrl: parsed.html_url,
      };
    },

    resolveCommit({ repo, ref }, signal) {
      return request(http, "ref resolution", () =>
        http
          .get(`repos/${repo}/commits/${encodeURIComponent(ref)}`, {
            signal,
            headers: { accept: "application/vnd.github.sha" },
          })
          .text()
      );
    },

    async getContents({ repo, path, ref }, signal) {
      const data = await request(http, "contents read", () =>
        http
          .get(`repos/${repo}/contents/${encodePath(path)}`, {
            signal,
            searchParams: { ref },
          })
          .json()
      );
      const parsed = contentsSchema.parse(data);
      if (Array.isArray(parsed)) return { kind: "dir", entries: parsed };
      if (parsed.type !== "file") {
        return { kind: "other", type: parsed.type, path: parsed.path };
      }
      return {
        kind: "file",
        file: {
          path: parsed.path,
          sha: parsed.sha,
          size: parsed.size,
          content:
            parsed.encoding === "base64" && parsed.content
              ? Buffer.from(parsed.content, "base64")
              : Buffer.alloc(0),
          htmlUrl: parsed.html_url,
        },
      };
    },

    async getTree({ repo, sha, recursive }, signal) {
      const data = await request(http, "tree read", () =>
        http
          .get(`repos/${repo}/git/trees/${encodeURIComponent(sha)}`, {
            signal,
            searchParams: recursive ? { recursive: "1" } : {},
          })
          .json()
      );
      const parsed = treeSchema.parse(data);
      return {
        sha: parsed.sha,
        truncated: parsed.truncated,
        entries: parsed.tree,
      };
    },
  };
};
