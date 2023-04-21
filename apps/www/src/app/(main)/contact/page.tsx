import { Contact } from "./components";
import { Chia } from "@/shared/meta/chia";
import type { Metadata } from "next";
import { getBaseUrl } from "@/utils/getBaseUrl";

export const metadata: Metadata = {
  title: "Contact Me",
  openGraph: {
    locale: "zh_TW",
    url: "https://chia1104.dev/about",
    siteName: Chia.name,
    title: "Contact Me",
    description: Chia.content,
    images: [
      {
        url: `${getBaseUrl({ isServer: true })}/api/og?title=Contact Me`,
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
    images: [`${getBaseUrl({ isServer: true })}/api/og?title=Contact Me`],
  },
};

const ContactPage = () => {
  return (
    <article className="main c-container mt-10">
      <Contact />
    </article>
  );
};

export default ContactPage;
