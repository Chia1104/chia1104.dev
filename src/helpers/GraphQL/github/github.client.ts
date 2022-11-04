import { GraphQLClient } from "graphql-request";
import { GITHUB_GRAPHQL_API, GH_PUBLIC_TOKEN } from "@chia/shared/constants";

const client = new GraphQLClient(GITHUB_GRAPHQL_API, {
  headers: {
    accept: "application/vnd.github.v3+json",
    authorization: `token ${GH_PUBLIC_TOKEN}`,
  },
});

export default client;
