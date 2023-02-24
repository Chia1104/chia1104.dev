import { Resume } from "@chia/components/server";
import { Chia } from "@chia/shared/meta/chia";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  openGraph: {
    type: "profile",
    locale: "zh_TW",
    url: "https://chia1104.dev/about",
    siteName: Chia.name,
    title: "About",
    description: Chia.content,
    images: [
      {
        url: "https://chia1104.dev/api/og?title=About",
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
    images: ["https://chia1104.dev/api/og?title=About"],
  },
};

const AboutPage = () => {
  return (
    <article className="main c-container mt-20">
      <Resume avatarSrc={"/me/me.JPG"} />
    </article>
  );
};

export default AboutPage;
