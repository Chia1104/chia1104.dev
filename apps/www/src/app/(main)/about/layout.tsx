import Gallery from "./gallery";
import type { Metadata } from "next";
import { Chia } from "@/shared/meta/chia";
import { Timeline, type TimelineTypes, Age } from "@chia/ui";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "About",
};

const AboutPage = (props: {
  children: ReactNode;
  spotifyPlaylist: ReactNode;
}) => {
  const transformData = Chia.resume.map((item) => ({
    id: item.id,
    title: item.company,
    subtitle: `${item.title} (${item.duration})`,
    startDate: item.startTime,
    content: item.detail && (
      <ul>
        {item.detail.map((desc, index) => (
          <li key={index}>{desc}</li>
        ))}
      </ul>
    ),
  })) satisfies TimelineTypes.Data[];
  return (
    <article className="main c-container prose dark:prose-invert mt-20 max-w-[700px] items-start">
      <h1>About Me</h1>
      <p>
        Currently <Age birthday={Chia.birthday} className="text-xl" /> years old
      </p>
      <Gallery />
      <p>
        Outside of programming, I enjoy traveling, playing video games with
        friends, and watching movies.
      </p>
      <h2>Favorite Songs</h2>
      {props.spotifyPlaylist}
      <h2>Timeline</h2>
      <Timeline data={transformData} />
    </article>
  );
};

export default AboutPage;
