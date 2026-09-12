import "server-only";
import { GraphQLClient } from "graphql-request";

import { env } from "./env";

const client = new GraphQLClient(env.GITHUB_GRAPHQL_API, {
  headers: {
    accept: "application/vnd.github.v3+json",
    authorization: `token ${env.GH_PUBLIC_TOKEN}`,
  },
  fetch,
});

export default client;
