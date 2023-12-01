import "server-only";
import { GraphQLClient } from "graphql-request";
import { env } from "@/env.mjs";

async function middleware(request: RequestInit) {
  return {
    ...request,
    next: { revalidate: 60 },
  };
}

const GITHUB_GRAPHQL_API =
  env.GITHUB_GRAPHQL_API ?? "https://api.github.com/graphql";
const GH_PUBLIC_TOKEN = env.GH_PUBLIC_TOKEN ?? "";

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
