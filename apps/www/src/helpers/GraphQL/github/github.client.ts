import { GraphQLClient } from "graphql-request";
import { GITHUB_GRAPHQL_API, GH_PUBLIC_TOKEN } from "@/shared/constants";

async function middleware(request: RequestInit) {
  return {
    ...request,
    next: { revalidate: 60, tags: ["github-repos"] },
  };
}

const client = new GraphQLClient(GITHUB_GRAPHQL_API, {
  headers: {
    accept: "application/vnd.github.v3+json",
    authorization: `token ${GH_PUBLIC_TOKEN}`,
  },
  // @ts-ignore
  requestMiddleware: middleware,
  fetch,
});

export default client;
