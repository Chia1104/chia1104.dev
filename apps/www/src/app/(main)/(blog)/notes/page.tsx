import type { Metadata } from "next";
import { Timeline, type TimelineTypes, ImageZoom, Image } from "@chia/ui";
import { getNotes } from "@/helpers/services/feeds.service";
import dayjs from "dayjs";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Notes",
};

const Page = async () => {
  const notes = await getNotes();
  const transformData = notes.items.map((item) => ({
    id: item.id,
    title: item.title,
    // titleProps: {
    //   className: "line-clamp-1",
    // },
    subtitle: dayjs(item.updatedAt).format("MMMM D, YYYY"),
    startDate: item.updatedAt,
    content: item.expert,
    link: `/notes/${item.slug}`,
  })) satisfies TimelineTypes.Data[];
  const hasNotes =
    !!transformData && Array.isArray(transformData) && transformData.length > 0;
  return (
    <div className="w-full">
      <h1>Notes</h1>
      {hasNotes ? (
        <Timeline data={transformData} enableSort={false} />
      ) : (
        <div className="c-bg-third relative flex flex-col items-center justify-center overflow-hidden rounded-lg px-5 py-10">
          <p>
            Coming soon. In the meantime, check out more{" "}
            <Link href="/about">Information</Link> about me.
          </p>
          <ImageZoom>
            <div className="not-prose aspect-h-1 aspect-w-1 relative w-[100px]">
              <Image
                src="/memo.png"
                alt="memo"
                className="object-cover"
                fill
                loading="lazy"
              />
            </div>
          </ImageZoom>
          <div className="dark:c-bg-gradient-purple-to-pink c-bg-gradient-yellow-to-pink absolute -z-40 h-full w-full opacity-50 blur-3xl" />
        </div>
      )}
    </div>
  );
};

export default Page;
