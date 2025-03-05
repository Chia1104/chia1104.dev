"use client";

import { unstable_ViewTransition as ViewTransition } from "react";

import type { FeedItemDBSource } from "@chia/api/services/feeds";

interface Props {
  feed: FeedItemDBSource;
}

const FeedTitle = ({ feed }: Props) => {
  return (
    <ViewTransition name={`view-transition-link-${feed.id}`}>
      <h1>{feed.title}</h1>
    </ViewTransition>
  );
};

export default FeedTitle;
