"use client";

import { type FC, use } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { type Post } from "db";
import { api } from "trpc-api";

interface Props {
  initFeed?: Post[];
  promise?: Promise<{ items: Post[]; duration: number; fetchedAt: Date }>;
}

const FeedList: FC<Props> = (props) => {
  const { initFeed, promise } = props;
  const promisePost = promise ? use(promise) : null;
  const clientPost = use(api.post.getAll.query());
  return (
    <p>
      FeedList
      {initFeed?.map((post) => {
        return <div key={post.id}>{post.title}</div>;
      })}
      {promisePost?.items?.map((post) => {
        return <div key={post.id}>{post.title}</div>;
      })}
      {clientPost?.items?.map((post) => {
        return <div key={post.id}>{post.title}</div>;
      })}
    </p>
  );
};

export default FeedList;
