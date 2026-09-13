import { Octokit } from "@octokit/core";
import { GraphqlResponseError } from "@octokit/graphql";
import { RequestError } from "@octokit/request-error";
import type { RequestRequestOptions } from "@octokit/types";

/**
 * One Octokit per token. The factory reads no env: the site binds its public token in
 * `client.public.ts` and the writing agent's host binds its own, so a scope never widens by
 * sharing an instance.
 */

const DEFAULT_TIMEOUT_MS = 30_000;

export type GitHubClient = Octokit;

export interface GitHubClientOptions {
  token: string;
  baseUrl?: string;
  /** Injected by tests. */
  fetch?: RequestRequestOptions["fetch"];
}

export const createGitHubClient = (
  options: GitHubClientOptions
): GitHubClient =>
  new Octokit({
    auth: options.token,
    baseUrl: options.baseUrl,
    userAgent: "chia1104.dev",
    request: { fetch: options.fetch },
  });

/** The caller's signal, if any, plus the per-request deadline. */
export const requestSignal = (signal: AbortSignal | undefined): AbortSignal =>
  signal
    ? AbortSignal.any([signal, AbortSignal.timeout(DEFAULT_TIMEOUT_MS)])
    : AbortSignal.timeout(DEFAULT_TIMEOUT_MS);

/**
 * What a caller may act on: the HTTP status and the operation. REST failures carry their
 * status; a GraphQL `NOT_FOUND` is reported as 404 and any other GraphQL error as 502, so
 * one branch handles both transports.
 */
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

/** Runs one request and rethrows a transport failure as `GitHubApiError`; anything else passes through. */
export const withGitHubErrors = async <TValue>(
  operation: string,
  request: () => Promise<TValue>
): Promise<TValue> => {
  try {
    return await request();
  } catch (error) {
    if (error instanceof RequestError) {
      throw new GitHubApiError(error.status, operation, { cause: error });
    }
    if (error instanceof GraphqlResponseError) {
      const notFound = error.errors?.some(
        (entry) => entry.type === "NOT_FOUND"
      );
      throw new GitHubApiError(notFound ? 404 : 502, operation, {
        cause: error,
      });
    }
    throw error;
  }
};
