import type { Metadata } from "next";
import { Timeline, type TimelineTypes } from "@chia/ui";
import { getNotes } from "@/helpers/services/feeds.service";
import dayjs from "dayjs";

export const metadata: Metadata = {
  title: "Notes",
};

const Page = async () => {
  const notes = await getNotes();
  const transformData = notes.items.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: dayjs(item.updatedAt).format("YYYY-MM-DD"),
    startDate: item.updatedAt,
    content: item.expert,
    link: `/notes/${item.slug}`,
  })) satisfies TimelineTypes.Data[];
  return (
    <div className="w-full">
      <h1>Notes</h1>
      <Timeline data={transformData} enableSort={false} />
    </div>
  );
};

export default Page;
