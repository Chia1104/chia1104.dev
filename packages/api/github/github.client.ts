import "server-only";
import { GraphQLClient } from "graphql-request";
import { env } from "./env";

const client = new GraphQLClient(env.GITHUB_GRAPHQL_API, {
  headers: {
    accept: "application/vnd.github.v3+json",
    authorization: `token ${env.GH_PUBLIC_TOKEN}`,
  },
  requestMiddleware: (request) => ({
    ...request,
    next: { revalidate: 60 },
  }),
  fetch,
});

export default client;
