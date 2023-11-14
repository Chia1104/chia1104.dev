import { Chia } from "@/shared/meta/chia";
import { Timeline, type TimelineTypes, Age } from "@chia/ui";

const TimelineParallel = () => {
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
  return <Timeline data={transformData} />;
};

export default TimelineParallel;
