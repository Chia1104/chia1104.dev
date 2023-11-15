import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "About",
};

export const revalidate = 60 * 60 * 24;
export const runtime = "edge";

const AboutPage = async (props: {
  children: ReactNode;
  spotifyPlaylist: ReactNode;
  timeline: ReactNode;
}) => {
  return (
    <article className="main c-container prose dark:prose-invert mt-20 max-w-[700px] items-start">
      {props.children}
      <h2>Favorite Songs</h2>
      {props.spotifyPlaylist}
      <h2>Timeline</h2>
      {props.timeline}
    </article>
  );
};

export default AboutPage;
