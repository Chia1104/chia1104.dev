import type { Metadata } from "next";
import { ImageZoom, Image } from "@chia/ui";
import { getPosts } from "@/services/feeds.service";
import Link from "next/link";
import { List } from "../_components/posts";

export const metadata: Metadata = {
  title: "Blog",
};

const Page = async () => {
  const posts = await getPosts(20);
  const hasPosts =
    !!posts && Array.isArray(posts.items) && posts.items.length > 0;
  return (
    <div className="w-full">
      <h1>Posts</h1>
      {hasPosts ? (
        <List
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
