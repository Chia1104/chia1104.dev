import { GitHub, Youtube, Design } from "@chia/components/server";
import { Design as DesignData } from "@chia/shared/meta/design";
import type { Metadata } from "next";
import { Chia } from "@chia/shared/meta/chia";
import githubClient from "@chia/helpers/GraphQL/github/github.client";
import { GET_REPOS } from "@chia/helpers/GraphQL/github/query";
import { RepoGql } from "@chia/shared/types";
import { getAllVideos } from "@chia/helpers/api/youtube";
import { cache } from "react";
import dayjs from "dayjs";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Portfolio",
  description: `${Chia.content} Welcome to my portfolio page. I always try to make the best of my time.`,
  openGraph: {
    type: "profile",
    locale: "zh_TW",
    url: "https://chia1104.dev/portfolio",
    siteName: Chia.name,
    title: "Portfolio",
    description: Chia.content,
    images: [
      {
        url: "https://chia1104.dev/api/og?title=Portfolio",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: Chia.name,
    description: Chia.content,
    creator: `@${Chia.name.toLowerCase()}`,
    images: ["https://chia1104.dev/api/og?title=Portfolio"],
  },
};

const getRepos = cache(async () => {
  return await githubClient.request<
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
  });
});

const now = cache(() => dayjs().format("YYYY-MM-DD HH:mm:ss"));

const PortfoliosPage = async () => {
  const youtubeData = getAllVideos(4);
  const githubData = getRepos();
  const [github, youtube] = await Promise.all([githubData, youtubeData]);
  return (
    <article className="main c-container">
      <header className="title pt-10 sm:self-start">
        <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
          GitHub Repositories
        </span>
      </header>
      <p className="c-description pb-7 sm:self-start">
        What I currently work on, the data is updated at {now()}.
      </p>
      {/*<Suspense fallback={<ReposLoader />}>*/}
      {/*  <GitHub repo={github} />*/}
      {/*</Suspense>*/}
      <GitHub repo={github.user.repositories.edges} />
      <hr className="c-border-primary my-10 w-full border-t-2" />
      <header className="title c-text-bg-sec-half dark:c-text-bg-primary-half sm:self-start">
        Youtube Playlists
      </header>
      <p className="c-description pb-7 sm:self-start">
        I have created a few video for my Youtube channel, the data is updated
        at {now()}.
      </p>
      {/*<Suspense fallback={<VideoLoader />}>*/}
      {/*  <Youtube status={status} data={data} />*/}
      {/*</Suspense>*/}
      <Youtube status={youtube.status} data={youtube.data} />
      <hr className="c-border-primary my-10 w-full border-t-2" />
      <Design data={DesignData} />
    </article>
  );
};

export default PortfoliosPage;
