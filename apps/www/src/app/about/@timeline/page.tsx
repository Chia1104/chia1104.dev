import meta from "@chia/meta";
import { Timeline } from "@chia/ui";
import type { TimelineTypes } from "@chia/ui";

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
    linkProps: {
      preview: true,
    },
  })) satisfies TimelineTypes.Data[];
  return <Timeline data={transformData} />;
};

export default TimelineParallel;
