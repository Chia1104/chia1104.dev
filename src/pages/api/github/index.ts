import type { RepoGql } from "@chia/shared/types";
import { GET_REPOS } from "@chia/helpers/GraphQL/github/query";
import type { NextApiRequest, NextApiResponse } from "next";
import githubGraphQLClient from "@chia/helpers/GraphQL/github/github.client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RepoGql[]>
) {
  try {
    const { user } = await githubGraphQLClient.request(GET_REPOS, {
      username: "chia1104",
      sort: "PUSHED_AT",
      limit: 6,
    });
    const repos: RepoGql[] = user.repositories.edges;
    res.status(200).json(repos);
  } catch (error: any) {
    console.error(error);
    res.status(500).json(error);
  }
}
