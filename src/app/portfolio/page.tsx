import { GitHub, Youtube, Design } from "@chia/components/server";
import { Page } from "@chia/components/client";
import { getBaseUrl } from "@chia/utils/getBaseUrl";
import type { RepoGql, Youtube as Y } from "@chia/shared/types";
import { Design as DesignData } from "@chia/shared/meta/design";

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
        <Design data={DesignData} />
      </article>
    </Page>
  );
};

export default PortfoliosPage;
