import type { RepoGql } from "@/shared/types";
import { type FC } from "react";
import githubClient from "@/helpers/GraphQL/github/github.client";
import { GET_REPOS } from "@/helpers/GraphQL/github/query";
import ReposList from "@/app/(main)/portfolio/@github/repos-list";

const Page: FC = async () => {
  const repos = (
    await githubClient.request<
      {
        user: { repositories: { edges: RepoGql[] } };
      },
      { username: string; sort: string; limit: number }
    >({
      document: GET_REPOS,
      variables: {
        username: "chia1104",
        sort: "PUSHED_AT",
        limit: 6,
      },
    })
  ).user.repositories.edges;

  return <ReposList repo={repos} />;
};

export default Page;
