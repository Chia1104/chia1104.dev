import GitHub from "@chia/components/pages/portfolios/GitHub";
import Youtube from "@chia/components/pages/portfolios/Youtube";
import { Page } from "@chia/components/shared";
import { getBaseUrl } from "@chia/utils/getBaseUrl";
import type { RepoGql, Youtube as Y } from "@chia/shared/types";

const getPortfoliosData = async () => {
  const github = (await fetch(`${getBaseUrl()}/api/github`, {
    cache: "no-store",
  }).then((res) => res.json())) as RepoGql[];
  const youtube = (await fetch(`${getBaseUrl()}/api/youtube`, {
    cache: "no-store",
  }).then((res) => res.json())) as Y;
  return {
    github,
    youtube,
  };
};

const PortfoliosPage = async () => {
  const { github, youtube } = await getPortfoliosData();
  return (
    <Page>
      <article className="main c-container">
        <GitHub repoData={github} />
        <hr className="my-10 c-border-primary border-t-2 w-full" />
        <Youtube videoData={youtube} />
        <hr className="my-10 c-border-primary border-t-2 w-full" />
      </article>
    </Page>
  );
};

export default PortfoliosPage;
