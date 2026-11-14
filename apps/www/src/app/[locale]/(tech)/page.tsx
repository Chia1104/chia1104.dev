import type { Metadata } from "next";
import { Suspense, ViewTransition } from "react";

import { ErrorBoundary } from "@sentry/nextjs";
import { getLocale, getTranslations } from "next-intl/server";
import type { Graph } from "schema-dts";

import meta from "@chia/meta";
import { WWW_BASE_URL } from "@chia/utils/config";

import { AboutMe } from "@/components/about/about-me";
import { FavoriteSongs } from "@/components/about/favorite-songs";
import { LocationHero } from "@/components/about/location-hero";
import { TimelineHero } from "@/components/about/timeline-hero";
import { Band, Panel } from "@/components/commons/ruled";
import { LatestFeeds } from "@/containers/about/latest-feeds";
import { SpotifyPlaylist } from "@/containers/about/spotify-playlist";
import { localizedMetadata } from "@/libs/i18n/alternates";

export const revalidate = 14400; // 4 hours

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return localizedMetadata({ href: "/", locale });
}

const Page = async () => {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("profile"),
  ]);
  const jsonLd: Graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${WWW_BASE_URL}/#website`,
        url: WWW_BASE_URL,
        name: meta.name,
        inLanguage: locale,
        author: { "@id": `${WWW_BASE_URL}/#person` },
      },
      {
        "@type": "Person",
        "@id": `${WWW_BASE_URL}/#person`,
        name: meta.name,
        alternateName: [meta.fullName, meta.chineseName],
        url: WWW_BASE_URL,
        image: meta.avatar,
        jobTitle: t("title"),
        sameAs: [
          meta.link.github,
          meta.link.linkedin,
          meta.link.x,
          meta.link.bluesky,
          meta.link.instagram,
        ].filter((link) => link !== undefined),
      },
    ],
  };

  return (
    <ViewTransition>
      <article className="flex w-full flex-col">
        <AboutMe />
        <ErrorBoundary>
          <Suspense>
            <LatestFeeds />
          </Suspense>
        </ErrorBoundary>
        <Band />
        <LocationHero />
        <Band />
        <Panel>
          <FavoriteSongs />
          <ErrorBoundary>
            <Suspense>
              <SpotifyPlaylist />
            </Suspense>
          </ErrorBoundary>
        </Panel>
        <Band />
        <TimelineHero />
      </article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </ViewTransition>
  );
};

export default Page;
