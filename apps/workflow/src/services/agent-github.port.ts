import type {
  GitHubEntryType,
  GitHubFile,
  GitHubPort,
  GitHubRef,
  GitHubTree,
} from "@chia/agent-writing/ports";
import {
  GitHubApiError,
  createGitHubClient,
} from "@chia/integrations/github/client";
import {
  GitHubContentType,
  createGitHubSource,
} from "@chia/integrations/github/source";
import type { GitHubSource } from "@chia/integrations/github/source";

import { env } from "../env";

/**
 * The allowlist is checked here, before any request, so a repository outside it costs
 * nothing and leaks nothing. Refs resolve once per port: the port lives for one turn, and
 * a tree listed and a file read in the same turn must agree on the commit.
 */

/** GitHub inlines a blob up to 1 MB; above that the body is withheld and a raw download would be needed. */
const MAX_FILE_BYTES = 1_000_000;
/** A NUL in the first 8 KB is the git heuristic for a binary file. */
const BINARY_PROBE_BYTES = 8_000;

const REPO_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\/[a-z0-9._-]+$/;

let sharedSource: GitHubSource | undefined;

const sourceOf = (): GitHubSource => {
  sharedSource ??= createGitHubSource(
    createGitHubClient({ token: env.GH_AGENT_TOKEN })
  );
  return sharedSource;
};

/** The model needs the status and what was asked for, never the provider's response body. */
const toModelError = (error: GitHubApiError, subject: string): Error => {
  switch (error.status) {
    case 404:
      return new Error(`${subject} was not found on GitHub.`, { cause: error });
    case 401:
    case 403:
      return new Error(
        `GitHub refused access to ${subject} (HTTP ${error.status}); the agent's token may lack scope or be rate limited.`,
        { cause: error }
      );
    default:
      return new Error(
        `GitHub failed for ${subject} (HTTP ${error.status}). Retry once later.`,
        { cause: error }
      );
  }
};

const isBinary = (bytes: Buffer): boolean =>
  bytes.subarray(0, BINARY_PROBE_BYTES).includes(0);

const entryTypeOf = (type: "blob" | "tree" | "commit"): GitHubEntryType => {
  switch (type) {
    case "blob":
      return "file";
    case "tree":
      return "dir";
    case "commit":
      return "submodule";
  }
};

export interface AgentGitHubPortOptions {
  /** `owner/name` entries, lower-cased, as `parseGitHubRepos` produced them. */
  allowedRepos: readonly string[];
  source?: GitHubSource;
}

export const createAgentGitHubPort = (
  options: AgentGitHubPortOptions
): GitHubPort => {
  const allowed = new Set(
    options.allowedRepos.map((repo) => repo.toLowerCase())
  );
  const source = options.source ?? sourceOf();
  const refs = new Map<string, Promise<GitHubRef>>();

  const assertAllowed = (repo: string): string => {
    const normalized = repo.trim().toLowerCase();
    if (!REPO_PATTERN.test(normalized)) {
      throw new Error(
        `"${repo}" is not a repository name of the form owner/name.`
      );
    }
    if (!allowed.has(normalized)) {
      throw new Error(
        `Repository "${normalized}" is not on the operator's GitHub allowlist. Ask them to add it under the writing agent's settings; do not read it another way.`
      );
    }
    return normalized;
  };

  const resolveRef = (
    repo: string,
    requestedRef: string | undefined,
    signal: AbortSignal | undefined
  ): Promise<GitHubRef> => {
    const ref = requestedRef?.trim() || undefined;
    const key = `${repo}@${ref ?? ""}`;
    let pending = refs.get(key);
    if (!pending) {
      pending = (async () => {
        const subject = `${repo}${ref ? ` at ${ref}` : ""}`;
        try {
          const resolved = await source.resolveRef({ repo, ref }, signal);
          return {
            repo,
            ref: resolved.ref,
            sha: resolved.sha,
            defaultBranch: resolved.defaultBranch,
            url: resolved.htmlUrl,
            description: resolved.description,
            private: resolved.private,
          };
        } catch (error) {
          throw error instanceof GitHubApiError
            ? toModelError(error, subject)
            : error;
        }
      })();
      // a failed resolution is retried on the next call rather than pinned for the turn
      pending.catch(() => refs.delete(key));
      refs.set(key, pending);
    }
    return pending;
  };

  return {
    // async so an allowlist refusal rejects like every other failure instead of throwing
    async resolveRef(input, signal) {
      const repo = assertAllowed(input.repo);
      return resolveRef(repo, input.ref, signal);
    },

    async listTree(input, signal): Promise<GitHubTree> {
      const repo = assertAllowed(input.repo);
      const path = input.path ?? "";
      const ref = await resolveRef(repo, input.ref, signal);
      const subject = `${repo}/${path || "(root)"} at ${ref.sha.slice(0, 7)}`;
      try {
        if (input.recursive) {
          // the trees API addresses a subtree by its own sha only, so the whole tree is
          // fetched once and narrowed here
          const tree = await source.getTree(
            { repo, sha: ref.sha, recursive: true },
            signal
          );
          const prefix = path ? `${path}/` : "";
          return {
            ref,
            path,
            truncated: tree.truncated,
            entries: tree.entries
              .filter((entry) => entry.path.startsWith(prefix))
              .map((entry) => ({
                path: entry.path,
                type: entryTypeOf(entry.type),
                size: entry.size,
              })),
          };
        }
        const contents = await source.getContents(
          { repo, path, ref: ref.sha },
          signal
        );
        if (contents.kind !== "dir") {
          throw new Error(
            `${repo}/${path} is a ${contents.kind === "file" ? "file" : contents.type}, not a directory; read it with github_read_file.`
          );
        }
        return {
          ref,
          path,
          truncated: false,
          entries: contents.entries.map((entry) => ({
            path: entry.path,
            type: entry.type,
            size: entry.type === GitHubContentType.Dir ? undefined : entry.size,
          })),
        };
      } catch (error) {
        throw error instanceof GitHubApiError
          ? toModelError(error, subject)
          : error;
      }
    },

    async readFile(input, signal): Promise<GitHubFile> {
      const repo = assertAllowed(input.repo);
      const ref = await resolveRef(repo, input.ref, signal);
      const subject = `${repo}/${input.path} at ${ref.sha.slice(0, 7)}`;
      let contents;
      try {
        contents = await source.getContents(
          { repo, path: input.path, ref: ref.sha },
          signal
        );
      } catch (error) {
        throw error instanceof GitHubApiError
          ? toModelError(error, subject)
          : error;
      }
      if (contents.kind === "dir") {
        throw new Error(
          `${repo}/${input.path} is a directory; list it with github_list_tree.`
        );
      }
      if (contents.kind === "other") {
        throw new Error(
          `${repo}/${input.path} is a ${contents.type} and has no content to read.`
        );
      }
      const { file } = contents;
      if (
        file.size > MAX_FILE_BYTES ||
        (file.size > 0 && file.content.length === 0)
      ) {
        throw new Error(
          `${subject} is ${file.size} bytes, above the ${MAX_FILE_BYTES}-byte limit; read a smaller file.`
        );
      }
      if (isBinary(file.content)) {
        throw new Error(`${subject} is a binary file.`);
      }
      return {
        ref,
        path: file.path,
        blobSha: file.sha,
        size: file.size,
        text: file.content.toString("utf8"),
        url: `${ref.url}/blob/${ref.sha}/${file.path}`,
      };
    },
  };
};
