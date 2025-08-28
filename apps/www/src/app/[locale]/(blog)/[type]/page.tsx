import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import Image from "@chia/ui/image";
import ImageZoom from "@chia/ui/image-zoom";

import FeedList from "@/components/blog/feed-list";
import { getFeedsWithType } from "@/services/feeds.service";

export const dynamicParams = false;

export const generateStaticParams = () => {
  return [{ type: "posts" }, { type: "notes" }];
};

export async function generateMetadata({
  params,
}: PagePropsWithLocale<{ type: "posts" | "notes" }>): Promise<Metadata> {
  const { type } = await params;
  if (!["posts", "notes"].includes(type)) {
    return notFound();
  }
  const t = await getTranslations(`blog.${type}`);
  return {
    title: t("doc-title"),
  };
}

const Page = async (
  props: PagePropsWithLocale<{ type: "posts" | "notes" }>
) => {
  const { type } = await props.params;
  if (!["posts", "notes"].includes(type)) {
    notFound();
  }
  const formattedType = type === "posts" ? "post" : "note";
  const feeds = await getFeedsWithType(formattedType, 20);
  const hasFeeds = Array.isArray(feeds.items) && feeds.items.length > 0;
  const t = await getTranslations(`blog.${type}`);
  return (
    <div className="w-full">
      <h1>{t("doc-title")}</h1>
      {hasFeeds ? (
        <FeedList
          type={formattedType}
          initialData={feeds.items}
          nextCursor={feeds.nextCursor}
          query={{
            limit: 10,
            orderBy: "id",
            sortOrder: "desc",
            type: formattedType,
          }}
        />
      ) : (
        <div className="c-bg-third relative flex flex-col items-center justify-center overflow-hidden rounded-lg px-5 py-10">
          <p>{t("no-content")}</p>
          <ImageZoom>
            <div className="not-prose aspect-h-1 aspect-w-1 relative w-[100px]">
              <Image
                src="https://pliosymjzzmsswrxbkih.supabase.co/storage/v1/object/public/public-assets/memo.png"
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
