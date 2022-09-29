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
import { trpc } from "@chia/utils/trpc.util";
import { getBaseUrl } from "@chia/utils/getBaseUrl";

interface Props {
  github: ApiRespond<RepoGql[]>;
  youtube: ApiRespond<YoutubeType>;
}

type DesignResult = {
  id: number;
  name: string;
  imageUrl: string;
};

export const getServerSideProps: GetServerSideProps = async () => {
  const github = await fetch(`${getBaseUrl()}/api/portfolio/github`);
  const youtube = await fetch(`${getBaseUrl()}/api/portfolio/youtube`);

  return {
    props: {
      github: { status: github.status, data: await github.json() },
      youtube: await youtube.json(),
    },
  };
};

const PortfoliosPage: NextPage<Props> = ({ github, youtube }) => {
  const name = Chia.name;
  const chinese_name = Chia.chineseName;
  const design = trpc.useQuery(["portfolio.all-design"]);

  return (
    <Layout
      title={`Portfolio | ${name} ${chinese_name} `}
      description={`${Chia.content} Welcome to my portfolio page. I always try to make the best of my time.`}
      type="profile">
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
        <Design
          data={design.data?.map((image: DesignResult) => image.imageUrl) || []}
        />
      </article>
    </Layout>
  );
};

export default PortfoliosPage;
