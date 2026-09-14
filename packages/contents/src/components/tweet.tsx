import { EmbeddedTweet, TweetNotFound, TweetSkeleton } from "react-tweet";
import type { Tweet as TweetData } from "react-tweet/api";

import { cn } from "@chia/ui/utils/cn.util";

/** X post ids are numeric snowflakes. */
export const TWEET_ID_PATTERN = /^\d{1,20}$/;

const FIGURE_CLASS = "not-prose mx-auto my-6 w-full max-w-137.5";

const PostLink = ({ id }: { id: string }) => (
  <figcaption className="mt-2 text-end text-xs">
    <a
      href={`https://x.com/i/status/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="link">
      View on X
    </a>
  </figcaption>
);

/** Renders a post the host already fetched; `tweet` absent means X no longer serves it. */
export const TweetCard = ({
  id,
  tweet,
  className,
}: {
  id: string;
  tweet?: TweetData;
  className?: string;
}) => (
  <figure className={cn(FIGURE_CLASS, className)}>
    {tweet ? <EmbeddedTweet tweet={tweet} /> : <TweetNotFound />}
    {tweet ? null : <PostLink id={id} />}
  </figure>
);

export const TweetCardSkeleton = ({ className }: { className?: string }) => (
  <figure className={cn(FIGURE_CLASS, className)}>
    <TweetSkeleton />
  </figure>
);

/**
 * Without data access this package cannot fetch a post, so the default only links to it. Hosts
 * that can fetch replace `Tweet` when compiling MDX.
 */
export const Tweet = ({ id }: { id: string }) =>
  TWEET_ID_PATTERN.test(id) ? (
    <figure className={FIGURE_CLASS}>
      <PostLink id={id} />
    </figure>
  ) : null;
