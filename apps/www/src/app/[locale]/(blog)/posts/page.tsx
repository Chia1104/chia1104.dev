import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import Image from "@chia/ui/image";
import ImageZoom from "@chia/ui/image-zoom";

import FeedList from "@/components/blog/feed-list";
import { getPosts } from "@/services/feeds.service";

export const metadata: Metadata = {
  title: "Blog",
};

const Page = async () => {
  const posts = await getPosts(20);
  const hasPosts = Array.isArray(posts.items) && posts.items.length > 0;
  const t = await getTranslations("blog.post");
  return (
    <div className="w-full">
      <h1>{t("doc-title")}</h1>
      {hasPosts ? (
        <FeedList
          type="post"
          initialData={posts.items}
          nextCursor={posts.nextCursor}
          query={{
            limit: 10,
            orderBy: "id",
            sortOrder: "desc",
            type: "post",
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
