import meta from "@chia/meta";
import Timeline from "@chia/ui/timeline";
import type { Data } from "@chia/ui/timeline/types";

export const TimelineHero = () => {
  const transformData = meta.timeline.map((item) => ({
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
    link: item.link,
  })) satisfies Data[];
  return (
    <>
      <h2>Timeline</h2>
      <Timeline data={transformData} />
    </>
  );
};
