import { Suspense, ViewTransition } from "react";

import { ErrorBoundary } from "@sentry/nextjs";

import { AboutMe } from "@/components/about/about-me";
import { FavoriteSongs } from "@/components/about/favorite-songs";
import { LocationHero } from "@/components/about/location-hero";
import { TimelineHero } from "@/components/about/timeline-hero";
import { Band, Panel } from "@/components/commons/ruled";
import { SpotifyPlaylist } from "@/containers/about/spotify-playlist";

export const revalidate = 14400; // 4 hours

const Page = () => {
  return (
    <ViewTransition>
      <article className="flex w-full flex-col">
        <AboutMe />
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
    </ViewTransition>
  );
};

export default Page;
