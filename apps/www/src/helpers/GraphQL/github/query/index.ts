import { gql } from "graphql-request";

export const GET_REPOS = gql`
  query ($username: String!, $sort: RepositoryOrderField!, $limit: Int) {
    user(login: $username) {
      repositories(
        first: $limit
        isLocked: false
        isFork: false
        ownerAffiliations: OWNER
        privacy: PUBLIC
        orderBy: { field: $sort, direction: DESC }
      ) {
        edges {
          node {
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
`;

export const GET_PINNED_REPOS = gql`
  query ($username: String!) {
    user(login: $username) {
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
