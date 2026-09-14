import "server-only";
import { Suspense } from "react";

import {
  TWEET_ID_PATTERN,
  TweetCard,
  TweetCardSkeleton,
} from "@chia/contents/components/tweet";

import { client } from "@/libs/orpc/client.rsc";

const TweetContent = async ({ id }: { id: string }) => {
  try {
    const result = await client.toolings.tweet({ id });
    return (
      <TweetCard
        id={id}
        tweet={result.status === "found" ? result.tweet : undefined}
      />
    );
  } catch (error) {
    // The post is decoration; a service outage must not take the article down with it.
    console.error(error);
    return <TweetCard id={id} />;
  }
};

/** The MDX `Tweet` for www: fetched through `toolings.tweet`, streamed after the article. */
export const Tweet = ({ id }: { id: string }) =>
  TWEET_ID_PATTERN.test(id) ? (
    <Suspense fallback={<TweetCardSkeleton />}>
      <TweetContent id={id} />
    </Suspense>
  ) : null;
