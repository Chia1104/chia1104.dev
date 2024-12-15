import type { Metadata } from "next";
import Link from "next/link";

import Image from "@chia/ui/image";
import ImageZoom from "@chia/ui/image-zoom";

import { getNotes } from "@/services/feeds.service";
import { PageParamsWithLocale } from "@/utils/i18n";

import { List } from "../_components/notes";

export const metadata: Metadata = {
  title: "Notes",
};

const Page = async ({ params }: { params: PageParamsWithLocale }) => {
  const { locale } = await params;
  const notes = await getNotes(20);
  const hasNotes = Array.isArray(notes.items) && notes.items.length > 0;
  return (
    <div className="w-full">
      <h1>Notes</h1>
      {hasNotes ? (
        <List
          locale={locale}
          initialData={notes.items}
          nextCursor={notes.nextCursor}
          query={{
            limit: 10,
            orderBy: "id",
            sortOrder: "desc",
            type: "note",
          }}
        />
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
          <div className="dark:c-bg-gradient-purple-to-pink c-bg-gradient-yellow-to-pink absolute -z-40 size-full opacity-50 blur-3xl" />
        </div>
      )}
    </div>
  );
};

export default Page;
