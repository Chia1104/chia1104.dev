import { Suspense, ViewTransition } from "react";

import { ErrorBoundary } from "@chia/ui/error-boundary";

import { AboutMe } from "@/components/about/about-me";
import { FavoriteSongs } from "@/components/about/favorite-songs";
import { LocationHero } from "@/components/about/location-hero";
import { TimelineHero } from "@/components/about/timeline-hero";
import { SpotifyPlaylist } from "@/containers/about/spotify-playlist";

export const revalidate = 14400; // 4 hours

const Page = () => {
  return (
    <ViewTransition>
      <article className="prose dark:prose-invert mt-20 max-w-[700px] items-start">
        <AboutMe />
        <LocationHero />
        <FavoriteSongs />
        <ErrorBoundary>
          <Suspense>
            <SpotifyPlaylist />
          </Suspense>
        </ErrorBoundary>
        <TimelineHero />
      </article>
    </ViewTransition>
  );
};

export default Page;
