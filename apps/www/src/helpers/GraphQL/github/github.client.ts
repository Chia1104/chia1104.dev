import { GraphQLClient } from "graphql-request";
import { env } from "@/env.mjs";

async function middleware(request: RequestInit) {
  return {
    ...request,
    next: { revalidate: 60, tags: ["github-repos"] },
  };
}

const client = new GraphQLClient(env.GITHUB_GRAPHQL_API, {
  headers: {
    accept: "application/vnd.github.v3+json",
    authorization: `token ${env.GH_PUBLIC_TOKEN}`,
  },
  // @ts-ignore
  requestMiddleware: middleware,
  fetch,
});

export default client;
