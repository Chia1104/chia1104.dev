import { GitHub, Youtube, Design } from "@chia/components/server";
import { Design as DesignData } from "@chia/shared/meta/design";
import type { Metadata } from "next";
import { Chia } from "@chia/shared/meta/chia";

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

const PortfoliosPage = async () => {
  return (
    <article className="main c-container">
      <header className="title pt-10 sm:self-start">
        <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
          GitHub Repositories
        </span>
      </header>
      <p className="c-description pb-7 sm:self-start">
        What I currently working on.
      </p>
      <GitHub />
      <hr className="c-border-primary my-10 w-full border-t-2" />
      <header className="title c-text-bg-sec-half dark:c-text-bg-primary-half sm:self-start">
        Youtube Playlists
      </header>
      <p className="c-description pb-7 sm:self-start">
        I have created a few video for my Youtube channel.
      </p>
      <Youtube />
      <hr className="c-border-primary my-10 w-full border-t-2" />
      <Design data={DesignData} />
    </article>
  );
};

export default PortfoliosPage;
