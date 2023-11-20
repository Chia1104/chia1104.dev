"use client";

import { type FC } from "react";
import type { PostFrontMatter } from "@/shared/types";
import dayjs from "dayjs";
import { Image, cn } from "@chia/ui";
import Link from "next/link";
import { motion } from "framer-motion";

interface PostsListProps {
  post: PostFrontMatter[];
}

interface PostItemProps {
  data: PostFrontMatter;
  i: number;
}

const PostItem: FC<PostItemProps> = ({ data, i }) => {
  return (
    <div className="c-bg-secondary group relative flex min-h-[365px] w-full flex-col rounded-xl px-4 py-6 shadow-lg transition duration-300 ease-in-out hover:-translate-y-1.5 md:px-6">
      <div
        className={cn(
          "aspect-h-9 aspect-w-16 c-bg-gradient-green-to-purple mb-3 w-full overflow-hidden rounded-xl"
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
      <h2 className="subtitle group-hover:text-secondary mb-3 line-clamp-1 leading-normal transition duration-300 ease-in-out">
        {data.title}
      </h2>
      <p className="c-description mb-3 line-clamp-3 leading-normal">
        {data.excerpt}
      </p>
      <p className="c-description mt-auto self-start">
        {dayjs(data.createdAt).format("MMMM D, YYYY")} &mdash;{" "}
        <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
          {data.readingMins}
        </span>
      </p>
      <Link scroll className="absolute inset-0" href={`/posts/${data?.slug}`} />
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
    <motion.div
      className="grid w-full grid-cols-1 gap-10 md:grid-cols-2"
      transition={{ duration: 0.3, type: "spring" }}
      variants={postAnimation}
      animate="show">
      {post.map((post: PostFrontMatter, index) => (
        <motion.div
          key={post.id}
          transition={{ type: "spring" }}
          variants={postCardAnimation}
          className={cn("h-auto w-full")}>
          <PostItem data={post} i={index} />
        </motion.div>
      ))}
    </motion.div>
  );
};

export default PostsList;
