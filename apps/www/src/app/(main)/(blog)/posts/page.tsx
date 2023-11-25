import type { Metadata } from "next";
import { Timeline, type TimelineTypes } from "@chia/ui";
import { getPosts } from "@/helpers/services/feeds.service";
import dayjs from "dayjs";

export const metadata: Metadata = {
  title: "Blog",
};

const Page = async () => {
  const posts = await getPosts();
  const transformData = posts.items.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: dayjs(item.updatedAt).format("YYYY-MM-DD"),
    startDate: item.updatedAt,
    content: item.expert,
    link: `/posts/${item.slug}`,
  })) satisfies TimelineTypes.Data[];
  return (
    <div className="w-full">
      <h1>Posts</h1>
      <Timeline data={transformData} enableSort={false} />
    </div>
  );
};

export default Page;
