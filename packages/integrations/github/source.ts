import type { Endpoints } from "@octokit/types";

import { GitHubApiError, requestSignal, withGitHubErrors } from "./client";
import type { GitHubClient } from "./client";

/**
 * Repository reads for the writing agent: a ref pinned to its commit, directory and tree
 * listings and file blobs. Ref resolution is one GraphQL query because the REST commit
 * endpoint returns the commit's whole diff; contents and trees are REST for their typed
 * shapes and the recursive listing GraphQL has no equivalent of.
 */

export interface GitHubRepositoryRef {
  /** `owner/name` as GitHub spells it. */
  fullName: string;
  defaultBranch: string;
  private: boolean;
  description: string | null;
  htmlUrl: string;
  /** The ref asked for, or the default branch. */
  ref: string;
  /** The commit it names; an annotated tag is peeled to its commit. */
  sha: string;
}

export const GitHubContentType = {
  File: "file",
  Dir: "dir",
  Symlink: "symlink",
  Submodule: "submodule",
} as const;

export type GitHubContentType =
  (typeof GitHubContentType)[keyof typeof GitHubContentType];

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
}

/** What a path holds at a ref; symlinks and submodules have no readable body here. */
export type GitHubContents =
  | { kind: "file"; file: GitHubFileContent }
  | { kind: "dir"; entries: GitHubContentEntry[] }
  | {
      kind: "other";
      type:
        | typeof GitHubContentType.Symlink
        | typeof GitHubContentType.Submodule;
      path: string;
    };

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

export interface GitHubSource {
  resolveRef(
    input: { repo: string; ref?: string },
    signal?: AbortSignal
  ): Promise<GitHubRepositoryRef>;
  getContents(
    input: { repo: string; path: string; ref: string },
    signal?: AbortSignal
  ): Promise<GitHubContents>;
  getTree(
    input: { repo: string; sha: string; recursive: boolean },
    signal?: AbortSignal
  ): Promise<GitHubTree>;
}

const REPOSITORY_REF = `
  query ($owner: String!, $name: String!, $ref: String!, $hasRef: Boolean!) {
    repository(owner: $owner, name: $name) {
      nameWithOwner
      isPrivate
      description
      url
      defaultBranchRef {
        name
        target {
          oid
        }
      }
      object(expression: $ref) @include(if: $hasRef) {
        oid
        ... on Tag {
          target {
            oid
          }
        }
      }
    }
  }
`;

interface RepositoryRefData {
  repository: {
    nameWithOwner: string;
    isPrivate: boolean;
    description: string | null;
    url: string;
    defaultBranchRef: { name: string; target: { oid: string } } | null;
    object?: { oid: string; target?: { oid: string } } | null;
  } | null;
}

type ContentsData =
  Endpoints["GET /repos/{owner}/{repo}/contents/{path}"]["response"]["data"];

const TREE_ENTRY_TYPES = new Set(["blob", "tree", "commit"]);

const isTreeEntryType = (type: string): type is GitHubTreeEntry["type"] =>
  TREE_ENTRY_TYPES.has(type);

const splitRepo = (repo: string) => {
  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    throw new Error(
      `"${repo}" is not a repository name of the form owner/name.`
    );
  }
  return { owner, name };
};

const toContents = (data: ContentsData): GitHubContents => {
  if (Array.isArray(data)) {
    return {
      kind: "dir",
      entries: data.map((entry) => ({
        name: entry.name,
        path: entry.path,
        type: entry.type,
        size: entry.size,
        sha: entry.sha,
      })),
    };
  }
  if (data.type !== GitHubContentType.File) {
    return { kind: "other", type: data.type, path: data.path };
  }
  return {
    kind: "file",
    file: {
      path: data.path,
      sha: data.sha,
      size: data.size,
      content:
        data.encoding === "base64" && data.content
          ? Buffer.from(data.content, "base64")
          : Buffer.alloc(0),
    },
  };
};

export const createGitHubSource = (client: GitHubClient): GitHubSource => ({
  async resolveRef({ repo, ref }, signal) {
    const { owner, name } = splitRepo(repo);
    const data = await withGitHubErrors("ref resolution", () =>
      client.graphql<RepositoryRefData>(REPOSITORY_REF, {
        owner,
        name,
        ref: ref ?? "",
        hasRef: ref !== undefined,
        request: { signal: requestSignal(signal) },
      })
    );
    const repository = data.repository;
    if (!repository?.defaultBranchRef) {
      throw new GitHubApiError(404, "ref resolution");
    }
    const sha =
      ref === undefined
        ? repository.defaultBranchRef.target.oid
        : (repository.object?.target?.oid ?? repository.object?.oid);
    if (!sha) {
      throw new GitHubApiError(404, "ref resolution");
    }
    return {
      fullName: repository.nameWithOwner,
      defaultBranch: repository.defaultBranchRef.name,
      private: repository.isPrivate,
      description: repository.description,
      htmlUrl: repository.url,
      ref: ref ?? repository.defaultBranchRef.name,
      sha,
    };
  },

  async getContents({ repo, path, ref }, signal) {
    const { owner, name } = splitRepo(repo);
    const response = await withGitHubErrors("contents read", () =>
      client.request("GET /repos/{owner}/{repo}/contents/{path}", {
        owner,
        repo: name,
        path,
        ref,
        request: { signal: requestSignal(signal) },
      })
    );
    return toContents(response.data);
  },

  async getTree({ repo, sha, recursive }, signal) {
    const { owner, name } = splitRepo(repo);
    const response = await withGitHubErrors("tree read", () =>
      client.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
        owner,
        repo: name,
        tree_sha: sha,
        recursive: recursive ? "1" : undefined,
        request: { signal: requestSignal(signal) },
      })
    );
    return {
      sha: response.data.sha,
      truncated: response.data.truncated,
      entries: response.data.tree.flatMap((entry) =>
        entry.path && entry.sha && entry.type && isTreeEntryType(entry.type)
          ? [
              {
                path: entry.path,
                type: entry.type,
                sha: entry.sha,
                size: entry.size,
              },
            ]
          : []
      ),
    };
  },
});
