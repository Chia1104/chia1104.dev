import type { ReactNode } from "react";

import type { Metadata } from "next";

import CurrentPlaying from "@/app/[locale]/_components/current-playing";

export const metadata: Metadata = {
  title: "About",
};

const AboutPage = (props: {
  children: ReactNode;
  spotifyPlaylist: ReactNode;
  timeline: ReactNode;
}) => {
  return (
    <article className="main c-container prose dark:prose-invert mt-20 max-w-[700px] items-start">
      {props.children}
      <h2>Favorite Songs</h2>
      <p>Currently, I'm listening to this song.</p>
      <CurrentPlaying
        className="mb-5"
        experimental={{
          displayBackgroundColorFromImage: true,
        }}
      />
      {props.spotifyPlaylist}
      <h2>Timeline</h2>
      {props.timeline}
    </article>
  );
};

export default AboutPage;
