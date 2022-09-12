import type { NextPage } from "next";
import { Layout } from "@chia/components/shared";
import GitHub from "@chia/components/pages/portfolios/GitHub";
import Youtube from "@chia/components/pages/portfolios/Youtube";
import { Design } from "@chia/components/pages/portfolios";
import type { GetServerSideProps } from "next";
import { Chia } from "@chia/shared/meta/chia";
import type {
  RepoGql,
  Youtube as YoutubeType,
  ApiRespond,
} from "@chia/shared/types";
import { IS_PRODUCTION } from "@chia/shared/constants";
import { trpc } from "@chia/utils/trpc.util";

interface Props {
  posterUrl: string[];
  github: ApiRespond<RepoGql[]>;
  youtube: ApiRespond<YoutubeType>;
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const HTTP = IS_PRODUCTION ? "https" : "http";
  const github = await fetch(
    `${HTTP}://${ctx.req.headers.host}/api/portfolio/github`
  );
  const youtube = await fetch(
    `${HTTP}://${ctx.req.headers.host}/api/portfolio/youtube`
  );
  // const url = await getListImageUrl();

  return {
    props: {
      // posterUrl: url,
      github: { status: github.status, data: await github.json() },
      youtube: await youtube.json(),
    },
  };
};

const PortfoliosPage: NextPage<Props> = ({ posterUrl, github, youtube }) => {
  const name = Chia.name;
  const chinese_name = Chia.chineseName;
  const design = trpc.useQuery(["portfolio.all-design"]);

  return (
    <Layout
      title={`Portfolio | ${name} ${chinese_name} `}
      description={`${Chia.content} Welcome to my portfolio page. I always try to make the best of my time.`}>
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
        <hr className="my-10 c-border-primary border-t-2 w-full" />
        <Design data={design.data?.map((image: any) => image.imageUrl) || []} />
      </article>
    </Layout>
  );
};

export default PortfoliosPage;
