"use client";

import { type FC } from "react";
import type { PostFrontMatter } from "@chia/shared/types";
import dayjs from "dayjs";
import { Image } from "@chia/components/client";
import Link from "next/link";
import { cn } from "@chia//utils/cn.util";

interface Props {
  data: PostFrontMatter;
  i: number;
}

const PostItem: FC<Props> = ({ data, i }) => {
  return (
    <div className="c-bg-secondary group relative flex min-h-[465px] w-full flex-col rounded-xl shadow-lg transition duration-300 ease-in-out hover:-translate-y-1.5 2xl:min-h-[520px]">
      <div
        className={cn(
          "aspect-w-16 aspect-h-9 mb-3 w-full overflow-hidden rounded-t-xl bg-gray-200",
          i === 0 && "lg:aspect-w-3 lg:aspect-h-1"
        )}>
        <Image
          src={data.headImg || "/posts/example-posts/example.jpg"}
          alt={data.title as string}
          className="rounded object-cover transition duration-300 ease-in-out group-hover:scale-[1.05]"
          loading="lazy"
          fill
          sizes="100vw"
          quality={100}
        />
      </div>
      <h2 className="subtitle mx-5 mb-3 leading-normal transition line-clamp-2 duration-300 ease-in-out group-hover:text-secondary">
        {data.title}
      </h2>
      <p className="c-description mx-5 mb-3 leading-normal line-clamp-3">
        {data.excerpt}
      </p>
      <p className="c-description mx-5 mt-auto mb-3 self-start">
        {dayjs(data.createdAt).format("MMMM D, YYYY")} &mdash;{" "}
        <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
          {data.readingMins}
        </span>
      </p>
      <Link
        scroll
        className="absolute top-0 bottom-0 right-0 left-0"
        href={`/posts/${data?.slug}`}
      />
    </div>
  );
};

export default PostItem;
