"use client";

import { type FC } from "react";
import type { PostFrontMatter } from "@chia/shared/types";
import PostItem from "./PostItem";
import { motion } from "framer-motion";
import cx from "classnames";
import { SerializedResult, useDeserialized } from "@chia/utils/hydration.util";

interface Props {
  post: SerializedResult<PostFrontMatter[]>;
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

const PostsList: FC<Props> = (props) => {
  const { post } = props;
  const _post = useDeserialized(post);
  return (
    <motion.article
      className="w-full grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-10"
      variants={postAnimation}
      animate={"show"}>
      {_post.map((post: PostFrontMatter, index) => (
        <motion.div
          key={post.id}
          variants={postCardAnimation}
          className={cx("w-full h-auto", index === 0 && "lg:col-span-2")}>
          <PostItem data={post} i={index} />
        </motion.div>
      ))}
    </motion.article>
  );
};

export default PostsList;
