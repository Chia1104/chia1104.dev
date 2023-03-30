"use client";

import { type FC } from "react";
import type { PostFrontMatter } from "@chia/shared/types";
import dayjs from "dayjs";
import { Image } from "@chia/ui";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@chia//utils/cn.util";

interface PostsListProps {
  post: PostFrontMatter[];
}

interface PostItemProps {
  data: PostFrontMatter;
  i: number;
}

const PostItem: FC<PostItemProps> = ({ data, i }) => {
  return (
    <div className="c-bg-secondary group relative flex min-h-[465px] w-full flex-col rounded-xl shadow-lg transition duration-300 ease-in-out hover:-translate-y-1.5 2xl:min-h-[520px]">
      <div
        className={cn(
          "aspect-h-9 aspect-w-16 mb-3 w-full overflow-hidden rounded-t-xl bg-gray-200",
          i === 0 && "lg:aspect-h-1 lg:aspect-w-3"
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
      <h2 className="subtitle mx-5 mb-3 line-clamp-2 leading-normal transition duration-300 ease-in-out group-hover:text-secondary">
        {data.title}
      </h2>
      <p className="c-description mx-5 mb-3 line-clamp-3 leading-normal">
        {data.excerpt}
      </p>
      <p className="c-description mx-5 mb-3 mt-auto self-start">
        {dayjs(data.createdAt).format("MMMM D, YYYY")} &mdash;{" "}
        <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
          {data.readingMins}
        </span>
      </p>
      <Link
        scroll
        className="absolute bottom-0 left-0 right-0 top-0"
        href={`/posts/${data?.slug}`}
      />
    </div>
  );
};

const postAnimation = {
  show: { transition: { staggerChildren: 0.1 } },
};

const postCardAnimation = {
  show: {
    y: [75, 0],
    opacity: [0, 1],
  },
};

const PostsList: FC<PostsListProps> = ({ post }) => {
  return (
    <motion.article
      className="grid w-full grid-cols-1 gap-10 lg:grid-cols-2 xl:grid-cols-3"
      transition={{ duration: 0.3, type: "spring" }}
      variants={postAnimation}
      animate={"show"}>
      {post.map((post: PostFrontMatter, index) => (
        <motion.div
          key={post.id}
          transition={{ type: "spring" }}
          variants={postCardAnimation}
          className={cn("h-auto w-full", index === 0 && "lg:col-span-2")}>
          <PostItem data={post} i={index} />
        </motion.div>
      ))}
    </motion.article>
  );
};

export default PostsList;
