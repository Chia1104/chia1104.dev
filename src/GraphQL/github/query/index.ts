import { gql } from 'graphql-request'

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
                        name
                        url
                        description
                        pushedAt
                        stargazerCount
                        forkCount
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
