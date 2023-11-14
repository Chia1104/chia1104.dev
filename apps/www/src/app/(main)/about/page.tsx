import Gallery from "./gallery";
import type { Metadata } from "next";
import { Chia } from "@/shared/meta/chia";
import { Timeline, type TimelineTypes } from "@chia/ui";

export const metadata: Metadata = {
  title: "About",
};

const AboutPage = () => {
  const transformData = Chia.resume.map((item) => ({
    id: item.id,
    title: item.company,
    subtitle: item.title,
    startDate: item.startTime,
  })) satisfies TimelineTypes.Data[];
  return (
    <article className="main c-container prose dark:prose-invert mt-20 max-w-[700px] items-start">
      <h1>About Me</h1>
      <Gallery />
      <p>
        Outside of programming, I enjoy traveling, playing video games with
        friends, and watching movies.
      </p>
      <h2>Timeline</h2>
      <Timeline data={transformData} />
    </article>
  );
};

export default AboutPage;
