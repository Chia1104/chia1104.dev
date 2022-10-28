import { type FC } from "react";
import type { PostFrontMatter } from "@chia/shared/types";
import dayjs from "dayjs";
import { Image } from "@chia/components/client";
import Link from "next/link";
import cx from "classnames";

interface Props {
  data: PostFrontMatter;
  i: number;
}

const PostItem: FC<Props> = ({ data, i }) => {
  return (
    <div className="w-full rounded-xl flex flex-col c-bg-secondary shadow-lg min-h-[465px] 2xl:min-h-[520px] group hover:-translate-y-1.5 duration-300 transition ease-in-out relative">
      <div
        className={cx(
          "aspect-w-16 aspect-h-9 w-full overflow-hidden rounded-t-xl bg-gray-200 mb-3",
          i === 0 && "lg:aspect-w-3 lg:aspect-h-1"
        )}>
        <Image
          src={data.headImg || "/posts/example-posts/example.jpg"}
          alt={data.title as string}
          className="object-cover rounded group-hover:scale-[1.05] duration-300 transition ease-in-out"
          loading="lazy"
          fill
          sizes="100vw"
          quality={100}
        />
      </div>
      <h2 className="subtitle mb-3 group-hover:text-secondary duration-300 transition ease-in-out line-clamp-2 leading-normal mx-5">
        {data.title}
      </h2>
      <p className="line-clamp-3 c-description leading-normal mb-3 mx-5">
        {data.excerpt}
      </p>
      <p className="mt-auto c-description mx-5 mb-3 self-start">
        {dayjs(data.createdAt).format("MMMM D, YYYY")} &mdash;{" "}
        <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
          {data.readingMins}
        </span>
      </p>
      <Link
        className="absolute top-0 bottom-0 right-0 left-0"
        href={{
          pathname: "/posts/[slug]/",
          query: { slug: data.slug },
        }}
      />
    </div>
  );
};

export default PostItem;
