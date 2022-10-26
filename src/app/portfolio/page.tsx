import GitHub from "@chia/components/pages/portfolios/GitHub";
import Youtube from "@chia/components/pages/portfolios/Youtube";
import { Page } from "@chia/components/shared";
import { getBaseUrl } from "@chia/utils/getBaseUrl";
import { use } from "react";

const getPortfoliosData = async () => {
  const github = await fetch(`${getBaseUrl()}/api/portfolio/github`);
  const youtube = await fetch(`${getBaseUrl()}/api/portfolio/youtube`);

  return {
    github: { status: github.status, data: await github.json() },
    youtube: await youtube.json(),
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
