import meta from "@chia/meta";
import Timeline from "@chia/ui/timeline/index";
import type { Data } from "@chia/ui/timeline/types";

const TimelineParallel = () => {
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
  return <Timeline data={transformData} />;
};

export default TimelineParallel;
