import type { Metadata } from "next";
import Link from "next/link";
import { ImageZoom, Image } from "@chia/ui";

export const metadata: Metadata = {
  title: "Blog",
};

const Page = () => {
  return (
    <article className="main c-container prose dark:prose-invert mt-20">
      <div className="c-bg-third relative flex flex-col items-center justify-center overflow-hidden rounded-lg px-5 py-10">
        <h1>Blog</h1>
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
    </article>
  );
};

export default Page;
