"use client";

import { type FC } from "react";
import type { PostFrontMatter } from "@chia/shared/types";
import PostItem from "./PostItem";
import { motion } from "framer-motion";
import { cn } from "@chia//utils/cn.util";

interface PostsListProps {
  post: PostFrontMatter[];
}

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
