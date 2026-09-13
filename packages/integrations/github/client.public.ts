import { createGitHubClient } from "./client";
import { env } from "./env";

/** The site's read-only public token; for profile data on the public site. */
export const publicGitHubClient = createGitHubClient({
  token: env.GH_PUBLIC_TOKEN,
  baseUrl: env.GITHUB_API,
});
