import { Suspense, ViewTransition } from "react";

import { ErrorBoundary } from "@chia/ui/error-boundary";

import { AboutMe } from "@/components/about/about-me";
import { FavoriteSongs } from "@/components/about/favorite-songs";
import { LocationHero } from "@/components/about/location-hero";
import { TimelineHero } from "@/components/about/timeline-hero";
import { SpotifyPlaylist } from "@/containers/about/spotify-playlist";

const AboutPage = () => {
  return (
    <ViewTransition>
      <AboutMe />
      <LocationHero />
      <FavoriteSongs />
      <ErrorBoundary>
        <Suspense>
          <SpotifyPlaylist />
        </Suspense>
      </ErrorBoundary>
      <TimelineHero />
    </ViewTransition>
  );
};

export default AboutPage;
