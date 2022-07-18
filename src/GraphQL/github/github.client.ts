import { GraphQLClient } from 'graphql-request'
import { GITHUB_GRAPHQL_API } from "@chia/utils/constants";

const client = new GraphQLClient(GITHUB_GRAPHQL_API, {
    headers: {
        accept: "application/vnd.github.v3+json",
        authorization: `token ${process.env.NEXT_PUBLIC_GH_PUBLIC_TOKEN}`,
    },
})

export default client
