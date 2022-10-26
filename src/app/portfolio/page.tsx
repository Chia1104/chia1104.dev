import GitHub from "@chia/components/pages/portfolios/GitHub";
import Youtube from "@chia/components/pages/portfolios/Youtube";
import { Page } from "@chia/components/shared";
import { getBaseUrl } from "@chia/utils/getBaseUrl";
import { use } from "react";
import type { RepoGql } from "@chia/shared/types";
import { GET_REPOS } from "@chia/GraphQL/github/query";
import githubGraphQLClient from "@chia/GraphQL/github/github.client";
import { getAllVideos } from "@chia/api/youtube";

const getPortfoliosData = async () => {
  const { user } = await githubGraphQLClient.request(GET_REPOS, {
    username: "chia1104",
    sort: "PUSHED_AT",
    limit: 6,
  });
  const repos: RepoGql[] = user.repositories.edges;
  const _data = await getAllVideos(4);

  return {
    github: { status: 418, data: repos },
    youtube: _data,
  };
};

const PortfoliosPage = () => {
  const { github, youtube } = use(getPortfoliosData());

  return (
    <Page>
      <article className="main c-container">
        <GitHub
          repoData={github.data}
          loading={github.status === 200 ? "succeeded" : "failed"}
          error={`Something went wrong. Status code: ${github.status}`}
        />
        <hr className="my-10 c-border-primary border-t-2 w-full" />
        <Youtube
          videoData={youtube}
          loading={youtube.status === 200 ? "succeeded" : "failed"}
          error={`Something went wrong. Status code: ${youtube.status}`}
        />
      </article>
    </Page>
  );
};

export default PortfoliosPage;
