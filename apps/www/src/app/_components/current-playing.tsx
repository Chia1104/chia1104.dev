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
  Progress,
} from "@chia/ui";
import { get, handleKyError } from "@chia/utils";
import { HTTPError } from "ky";
import {
  type FC,
  type ReactNode,
  useState,
  useEffect,
  createContext,
  type Dispatch,
  type SetStateAction,
  useContext,
} from "react";
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

type State = number;

const CurrentPlayingContext = createContext<
  [State, Dispatch<SetStateAction<State>>]
>([0, () => {}]);

const useCurrentPlayingContext = () => {
  const context = useContext(CurrentPlayingContext);
  if (!context) {
    throw new Error(
      "useCurrentPlayingContext must be used within a CurrentPlayingContextProvider"
    );
  }
  return context;
};

const CurrentPlayingContextProvider: FC<{
  children: ReactNode;
  initValue: State;
}> = ({ children, initValue }) => {
  const [value, setValue] = useState(initValue);
  return (
    <CurrentPlayingContext.Provider value={[value, setValue]}>
      {children}
    </CurrentPlayingContext.Provider>
  );
};

const ProgressBar: FC<UseQueryResult<CurrentPlaying, HTTPError>> = (props) => {
  const [value] = useCurrentPlayingContext();
  return (
    <Progress
      value={(value / (props.data?.item.duration_ms ?? 1)) * 100}
      className="h-1"
    />
  );
};

const Card: FC<
  UseQueryResult<CurrentPlaying, HTTPError> & {
    className?: string;
  }
> = (props) => {
  const [, setValue] = useCurrentPlayingContext();

  // Sync the progress bar with the current playing song
  useEffect(() => {
    if (!props.isFetching && props.isSuccess && props.data?.is_playing) {
      setValue(props.data?.progress_ms ?? 0);
    }
  }, [
    props.data?.is_playing,
    props.isFetching,
    props.isSuccess,
    props.data?.item.duration_ms,
    props.data?.progress_ms,
  ]);

  // Update the progress bar
  useEffect(() => {
    if (props.data?.is_playing) {
      const interval = setInterval(() => {
        setValue((prev) => {
          if (prev < props.data?.item.duration_ms) {
            return prev + 1000;
          }
          props.refetch();
          return 0;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [
    props.data?.is_playing,
    props.data?.item.duration_ms,
    props.data?.progress_ms,
  ]);
  return (
    <HoverCard>
      <HoverCardTrigger asChild className="prose dark:prose-invert z-10">
        <div
          className={cn(
            "c-bg-third relative line-clamp-1 flex w-fit max-w-[200px] items-center gap-2 rounded-full border-[#FCA5A5]/50 px-4 py-2 text-sm shadow-[0px_0px_15px_4px_rgb(252_165_165_/_0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252_/_0.3)]",
            props.className
          )}>
          <span className="i-mdi-spotify size-5 text-[#1DB954]" />
          {props.isLoading ? (
            <div className="c-bg-primary h-5 w-20 animate-pulse rounded-full" />
          ) : !!props.data ? (
            <Link
              className="m-0 line-clamp-1 w-[85%]"
              href={props.data?.item.external_urls.spotify ?? "/"}
              target="_blank">
              {props.data.item.name} - {props.data.item.artists[0].name}
            </Link>
          ) : (
            <p className="m-0">Nothing Playing</p>
          )}
          {!!props.data && <span className="i-lucide-sparkles size-5" />}
        </div>
      </HoverCardTrigger>
      {props.data && (
        <HoverCardContent
          className={cn(
            "c-bg-third z-20 flex h-[150px] w-72 flex-col items-start justify-center gap-4 border-[#FCA5A5]/50 shadow-[0px_0px_15px_4px_rgb(252_165_165_/_0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252_/_0.3)]",
            props.isError &&
              "border-danger/50 dark:border-danger/50 shadow-[0px_0px_25px_4px_rgb(244_67_54_/_0.3)] dark:shadow-[0px_0px_25px_4px_rgb(244_67_54_/_0.3)]"
          )}>
          <div className="flex items-center gap-5">
            <img
              src={props.data?.item.album.images[0].url}
              alt={props.data?.item.album.name}
              className="m-0 size-20 rounded-lg object-cover"
            />
            <div className="prose dark:prose-invert p-1">
              <h4 className="line-clamp-1">{props.data?.item.name}</h4>
              <p className="line-clamp-1">{props.data?.item.artists[0].name}</p>
            </div>
          </div>
          {props.isSuccess && <ProgressBar {...props} />}
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

  if (children) {
    return <>{typeof children === "function" ? children(result) : children}</>;
  }

  if (result.isLoading) {
    return (
      <div
        className={cn(
          "c-bg-third relative line-clamp-1 flex w-fit max-w-[200px] items-center gap-2 rounded-full border-[#FCA5A5]/50 px-4 py-2 text-sm shadow-[0px_0px_15px_4px_rgb(252_165_165_/_0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252_/_0.3)]",
          className
        )}>
        <span className="i-mdi-spotify size-5 text-[#1DB954]" />
        <div className="c-bg-primary h-5 w-20 animate-pulse rounded-full" />
      </div>
    );
  }

  return (
    <CurrentPlayingContextProvider initValue={result.data?.progress_ms ?? 0}>
      <Card {...result} className={className} />
    </CurrentPlayingContextProvider>
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
