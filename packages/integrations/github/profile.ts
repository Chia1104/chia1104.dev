import type { GitHubClient } from "./client";

/** Public profile data for the site: pinned repositories and the contribution calendar. */

export interface PinnedRepositoryNode {
  id: string;
  name: string;
  url: string;
  description: string | null;
  pushedAt: string;
  stargazerCount: number;
  forkCount: number;
  openGraphImageUrl: string;
  primaryLanguage: { name: string; color: string } | null;
}

export interface PinnedRepositories {
  user: { pinnedItems: { edges: { node: PinnedRepositoryNode }[] } };
}

export interface ContributionDay {
  date: string;
  contributionCount: number;
  weekday: number;
  color: string;
}

export interface Contributions {
  user: {
    contributionsCollection: {
      contributionCalendar: {
        totalContributions: number;
        weeks: { contributionDays: ContributionDay[] }[];
      };
    };
  };
}

const PINNED_REPOSITORIES = `
  query ($login: String!) {
    user(login: $login) {
      pinnedItems(first: 6, types: REPOSITORY) {
        edges {
          node {
            ... on Repository {
              id
              name
              url
              description
              pushedAt
              stargazerCount
              forkCount
              openGraphImageUrl
              primaryLanguage {
                name
                color
              }
            }
          }
        }
      }
    }
  }
`;

const CONTRIBUTIONS = `
  query ($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              weekday
              color
            }
          }
        }
      }
    }
  }
`;

export const getPinnedRepos = (
  client: GitHubClient,
  login: string
): Promise<PinnedRepositories> =>
  client.graphql<PinnedRepositories>(PINNED_REPOSITORIES, { login });

/** `from` and `to` are ISO timestamps; GitHub allows at most one year between them. */
export const getContributions = (
  client: GitHubClient,
  login: string,
  from: string,
  to: string
): Promise<Contributions> =>
  client.graphql<Contributions>(CONTRIBUTIONS, { login, from, to });
