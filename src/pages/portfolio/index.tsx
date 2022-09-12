import type { NextPage } from "next";
import { Layout } from "@chia/components/shared";
import GitHub from "@chia/components/pages/portfolios/GitHub";
import Youtube from "@chia/components/pages/portfolios/Youtube";
import { getListImageUrl } from "@chia/firebase/client/files/services";
import { Design } from "@chia/components/pages/portfolios";
import type { GetServerSideProps } from "next";
import { Chia } from "@chia/shared/meta/chia";
import type {
  RepoGql,
  Youtube as YoutubeType,
  ApiRespond,
} from "@chia/shared/types";
import { BASE_URL } from "@chia/shared/constants";

interface Props {
  posterUrl: string[];
  github: ApiRespond<RepoGql[]>;
  youtube: ApiRespond<YoutubeType>;
}

export const getServerSideProps: GetServerSideProps = async () => {
  const github = await fetch(`${BASE_URL}/api/portfolio/github`);
  const youtube = await fetch(`${BASE_URL}/api/portfolio/youtube`);
  const url = await getListImageUrl();

  return {
    props: {
      posterUrl: url,
      github: { status: github.status, data: await github.json() },
      youtube: await youtube.json(),
    },
  };
};

const PortfoliosPage: NextPage<Props> = ({ posterUrl, github, youtube }) => {
  const name = Chia.name;
  const chinese_name = Chia.chineseName;

  return (
    <Layout
      title={`Portfolio | ${name} ${chinese_name} `}
      description={`${Chia.content} Welcome to my portfolio page. I always try to make the best of my time.`}>
      <article className="main c-container">
        <GitHub
          repoData={github.data}
          loading={github.status === 200 ? "succeeded" : "failed"}
        />
        <hr className="my-10 c-border-primary border-t-2 w-full" />
        <Youtube
          videoData={youtube}
          loading={youtube.status === 200 ? "succeeded" : "failed"}
        />
        <hr className="my-10 c-border-primary border-t-2 w-full" />
        <Design data={posterUrl} />
      </article>
    </Layout>
  );
};

export default PortfoliosPage;
