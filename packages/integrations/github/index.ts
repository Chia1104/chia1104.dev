import client from "./github.client";
import { GET_PINNED_REPOS, GET_REPOS, GET_CONTRIBUTIONS } from "./query";
import type { RepoGql, Contributions } from "./types";

export interface PinnedRepository {
  user: {
    pinnedItems: {
      edges: RepoGql[];
    };
  };
}

export interface Repository {
  user: {
    repositories: {
      edges: RepoGql[];
    };
  };
}

export const getPinnedRepos = (userName: string) =>
  client.request<PinnedRepository>(GET_PINNED_REPOS, { username: userName });

export const getRepos = (userName: string, sort?: string, limit?: number) =>
  client.request<Repository>(GET_REPOS, {
    username: userName,
    sort,
    limit,
  });

export const getContributions = (userName: string, from: string, to: string) =>
  client.request<Contributions>(GET_CONTRIBUTIONS, {
    login: userName,
    from,
    to,
  });
