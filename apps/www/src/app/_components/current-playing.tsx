"use client";

import {
  useQuery,
  type UseQueryResult,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  cn,
  ErrorBoundary,
  Link,
} from "@chia/ui";
import { get, handleKyError } from "@chia/utils";
import { HTTPError } from "ky";
import { type FC, type ReactNode } from "react";
import { type CurrentPlaying } from "@chia/api/spotify/types";

interface Props {
  children?:
    | ReactNode
    | ((result: UseQueryResult<CurrentPlaying, HTTPError>) => ReactNode);
  queryOptions?: Omit<
    UseQueryOptions<CurrentPlaying, HTTPError>,
    "queryKey" | "queryFn"
  >;
  className?: string;
}

const Card: FC<
  UseQueryResult<CurrentPlaying, HTTPError> & {
    className?: string;
  }
> = (props) => {
  return (
    <HoverCard>
      <HoverCardTrigger asChild className="prose dark:prose-invert z-10">
        <div
          className={cn(
            "relative line-clamp-1 flex w-fit max-w-80 items-center gap-2 rounded-full border-[#FCA5A5]/50 px-4 py-2 text-sm shadow-[0px_0px_15px_4px_rgb(252_165_165_/_0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252_/_0.3)]",
            props.className
          )}>
          <span className="i-mdi-spotify size-5 text-[#1DB954]" />
          {props.isLoading ? (
            <div className="c-bg-primary h-5 w-20 animate-pulse rounded-full" />
          ) : !!props.data ? (
            <Link
              className="m-0 line-clamp-1 w-[95%]"
              href={props.data?.item.external_urls.spotify ?? "/"}
              target="_blank">
              {props.data.item.name} - {props.data.item.artists[0].name}
            </Link>
          ) : (
            <p className="m-0">Nothing Playing</p>
          )}
        </div>
      </HoverCardTrigger>
      {props.data && (
        <HoverCardContent
          className={cn(
            "z-20 flex w-72 items-center gap-5 border-[#FCA5A5]/50 shadow-[0px_0px_15px_4px_rgb(252_165_165_/_0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252_/_0.3)]",
            props.isError &&
              "border-danger/50 dark:border-danger/50 shadow-[0px_0px_25px_4px_rgb(244_67_54_/_0.3)] dark:shadow-[0px_0px_25px_4px_rgb(244_67_54_/_0.3)]"
          )}>
          <img
            src={props.data?.item.album.images[0].url}
            alt={props.data?.item.album.name}
            className="size-20 rounded-lg object-cover"
          />
          <div className="prose dark:prose-invert p-1">
            <h4 className="line-clamp-1">{props.data?.item.name}</h4>
            <p className="line-clamp-1">{props.data?.item.artists[0].name}</p>
          </div>
        </HoverCardContent>
      )}
    </HoverCard>
  );
};

const CurrentPlaying: FC<Props> = ({ children, queryOptions, className }) => {
  const result = useQuery<CurrentPlaying, HTTPError>({
    refetchInterval: (ctx) => {
      if (
        ctx.state.data?.is_playing &&
        ctx.state.data?.item.duration_ms &&
        ctx.state.data?.progress_ms
      ) {
        const delta =
          (ctx.state.data?.item.duration_ms - ctx.state.data?.progress_ms) / 2;
        return delta > 30_000 ? delta : 30_000;
      }
      return 60_000;
    },
    refetchOnWindowFocus: "always",
    ...queryOptions,
    queryKey: ["spotify-current-playing"],
    queryFn: async ({ signal }) => {
      return await get<CurrentPlaying, undefined>(
        "/api/v1/spotify/playing",
        undefined,
        {
          signal,
        }
      );
    },
  });
  return (
    <>
      {children ? (
        typeof children === "function" ? (
          children(result)
        ) : (
          children
        )
      ) : (
        <Card {...result} className={className} />
      )}
    </>
  );
};

const Index: FC<Props> = (props) => {
  return (
    <ErrorBoundary<HTTPError>>
      <CurrentPlaying {...props} />
    </ErrorBoundary>
  );
};

export default Index;
