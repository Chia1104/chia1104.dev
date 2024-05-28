import client from "./github.client";
import { GET_PINNED_REPOS, GET_REPOS } from "./query";
import type { RepoGql } from "./types";

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
