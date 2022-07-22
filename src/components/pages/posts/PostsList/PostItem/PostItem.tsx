import { type FC } from "react";
import type { PostFrontMatter } from "@chia/utils/types/post";
import dayjs from "dayjs";
import Image from "@chia/components/globals/Image";
import cx from "classnames";
import Link from "@chia/components/globals/Link";

interface Props {
  data: PostFrontMatter;
  i: number;
}

export const PostItem: FC<Props> = ({ data, i }) => {
  return (
    <div className="w-full rounded-xl flex flex-col c-bg-secondary shadow-lg min-h-[465px] 2xl:min-h-[520px] group hover:-translate-y-1.5 duration-300 transition ease-in-out relative">
      <div
        className={cx(
          "aspect-w-16 aspect-h-9 w-full overflow-hidden rounded-t-xl bg-gray-200 mb-3",
          i === 0 && "lg:aspect-w-3 lg:aspect-h-1"
        )}
      >
        <Image
          src={data.headImg || "/posts/example-posts/example.jpg"}
          alt={data.title}
          className="rounded group-hover:scale-[1.1] duration-300 transition ease-in-out"
          loading="lazy"
          objectFit="cover"
          layout="fill"
          quality={100}
        />
      </div>
      <header className="subtitle mb-3 group-hover:text-secondary duration-300 transition ease-in-out line-clamp-2 leading-normal mx-5">
        {data.title}
      </header>
      <p className="line-clamp-3 c-description leading-normal mb-3 mx-5">
        {data.excerpt}
      </p>
      <footer className="mt-auto c-description mx-5 mb-3 self-start">
        {dayjs(data.createdAt).format("MMMM D, YYYY")} &mdash;{" "}
        <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
          {data.readingMins}
        </span>
      </footer>
      <Link
        href={{
          pathname: "/posts/[slug]/",
          query: { slug: data.slug },
        }}
      >
        <a className="absolute top-0 bottom-0 right-0 left-0" />
      </Link>
    </div>
  );
};
