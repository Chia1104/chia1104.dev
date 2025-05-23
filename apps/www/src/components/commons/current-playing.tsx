"use client";

import {
  useState,
  useEffect,
  createContext,
  useRef,
  useContext,
  useCallback,
  useMemo,
  useTransition,
} from "react";
import type { FC, ReactNode, Dispatch, SetStateAction } from "react";

import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult, UseQueryOptions } from "@tanstack/react-query";
import type { HTTPError } from "ky";

import type { CurrentPlaying } from "@chia/api/spotify/types";
import { ErrorBoundary } from "@chia/ui/error-boundary";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@chia/ui/hover-card";
import Image from "@chia/ui/image";
import Link from "@chia/ui/link";
import Marquee from "@chia/ui/marquee";
import { Progress } from "@chia/ui/progress";
import TextShimmer from "@chia/ui/text-shimmer";
import { cn } from "@chia/ui/utils/cn.util";
import { getBrightness } from "@chia/ui/utils/get-brightness";
import { experimental_getImgAverageRGB } from "@chia/ui/utils/get-img-average-rgb";
import { serviceRequest } from "@chia/utils";

interface ExtendsProps {
  className?: string;
  hoverCardContentClassName?: string;
  experimental?: {
    displayBackgroundColorFromImage?: boolean;
  };
}

interface Props extends ExtendsProps {
  children?:
    | ReactNode
    | ((result: UseQueryResult<CurrentPlaying, HTTPError>) => ReactNode);
  queryOptions?: Omit<
    UseQueryOptions<CurrentPlaying, HTTPError>,
    "queryKey" | "queryFn"
  >;
}

type State = number;

const CurrentPlayingContext = createContext<
  [State, Dispatch<SetStateAction<State>>]
>([0, () => undefined]);

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

const Card: FC<UseQueryResult<CurrentPlaying, HTTPError> & ExtendsProps> = (
  props
) => {
  const [, setValue] = useCurrentPlayingContext();
  const [bgRGB, setBgRGB] = useState<number[]>([]);
  const [isLight, setIsLight] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isPending, startTransition] = useTransition();

  // Sync the progress bar with the current playing song
  useEffect(() => {
    if (!props.isFetching && props.isSuccess && props.data?.is_playing) {
      setValue(props.data.progress_ms);
    }
  }, [
    props.data?.is_playing,
    props.isFetching,
    props.isSuccess,
    props.data?.item.duration_ms,
    props.data?.progress_ms,
    setValue,
  ]);

  // Update the progress bar
  useEffect(() => {
    if (props.data?.is_playing) {
      const interval = setInterval(() => {
        setValue((prev) => {
          if (prev < props.data.item.duration_ms) {
            return prev + 1000;
          }
          void props.refetch();
          return 0;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [setValue, props]);

  const handleImageLoad = useCallback(
    (img: HTMLImageElement) => {
      if (
        props.experimental?.displayBackgroundColorFromImage &&
        props.data?.item.album.images[0].url
      ) {
        startTransition(() => {
          const rgb = experimental_getImgAverageRGB(img);
          const { isLight } = getBrightness(rgb);
          setIsLight(isLight);
          setBgRGB(rgb);
        });
      }
    },
    [
      props.data?.item.album.images,
      props.experimental?.displayBackgroundColorFromImage,
    ]
  );

  const MemoImage = useMemo(
    () => (
      <>
        {props.data && (
          <Image
            crossOrigin="anonymous"
            width={80}
            height={80}
            sizes="80px"
            blur={false}
            onLoad={(e) => handleImageLoad(e.target as HTMLImageElement)}
            ref={imgRef}
            src={props.data.item.album.images[0].url}
            alt={props.data.item.album.name}
            className="m-0 size-20 rounded-lg bg-gray-400 object-cover"
          />
        )}
      </>
    ),
    [props.data, handleImageLoad]
  );

  const MemoTitle = useMemo(
    () => (
      <>
        {!!props.data && props.data.item.name.length > 13 ? (
          <Marquee className="w-full p-0" repeat={2}>
            <h4
              className={cn(
                "text-md mb-2 mt-0",
                props.experimental?.displayBackgroundColorFromImage &&
                  !isPending
                  ? isLight
                    ? "text-dark"
                    : "text-light"
                  : ""
              )}>
              {props.data.item.name}
            </h4>
          </Marquee>
        ) : (
          <h4
            className={cn(
              "mb-2 mt-0 line-clamp-1 text-lg",
              props.experimental?.displayBackgroundColorFromImage && !isPending
                ? isLight
                  ? "text-dark"
                  : "text-light"
                : ""
            )}>
            {props.data?.item.name}
          </h4>
        )}
      </>
    ),
    [
      isPending,
      props.data,
      isLight,
      props.experimental?.displayBackgroundColorFromImage,
    ]
  );

  const MemoLink = useMemo(
    () => (
      <>
        {props.data ? (
          <Marquee className="w-[85%] p-0" repeat={2} pauseOnHover>
            <Link
              className="m-0 text-sm"
              href={props.data.item.external_urls.spotify}
              target="_blank">
              <TextShimmer className="m-0 flex w-full p-0">
                {props.data.item.name} - {props.data.item.artists[0].name}
              </TextShimmer>
            </Link>
          </Marquee>
        ) : (
          <p className="m-0">Not Playing</p>
        )}
      </>
    ),
    [props.data]
  );

  return (
    <HoverCard>
      <HoverCardTrigger asChild className="prose dark:prose-invert z-10">
        <div
          className={cn(
            "c-bg-third relative line-clamp-1 flex w-fit max-w-[200px] items-center gap-2 rounded-full border-[#FCA5A5]/50 px-4 py-2 text-sm shadow-[0px_0px_15px_4px_rgb(252_165_165_/_0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252_/_0.3)] not-prose",
            props.className
          )}>
          <span className="i-mdi-spotify size-5 text-[#1DB954]" />
          {props.isLoading ? (
            <div className="c-bg-primary h-5 w-20 animate-pulse rounded-full" />
          ) : (
            MemoLink
          )}
        </div>
      </HoverCardTrigger>
      {props.data && (
        <HoverCardContent
          style={{
            backgroundColor:
              bgRGB.length === 3
                ? `rgba(${bgRGB[0]}, ${bgRGB[1]}, ${bgRGB[2]}, 0.3)`
                : undefined,
          }}
          className={cn(
            "z-20 flex h-[150px] w-72 flex-col items-start justify-center gap-4 border-[#FCA5A5]/50 shadow-[0px_0px_15px_4px_rgb(252_165_165_/_0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252_/_0.3)] not-prose",
            props.isError &&
              "border-danger/50 dark:border-danger/50 shadow-[0px_0px_25px_4px_rgb(244_67_54_/_0.3)] dark:shadow-[0px_0px_25px_4px_rgb(244_67_54_/_0.3)]",
            props.experimental?.displayBackgroundColorFromImage && !isPending
              ? "backdrop-blur-lg"
              : "c-bg-third",
            props.hoverCardContentClassName
          )}>
          <div className="flex items-center gap-5">
            {MemoImage}
            <div
              className={cn(
                "overflow-hidden p-1",
                props.experimental?.displayBackgroundColorFromImage &&
                  !isPending
                  ? "not-prose"
                  : "prose dark:prose-invert"
              )}>
              {MemoTitle}
              <p
                className={cn(
                  "mt-0 line-clamp-1 text-sm",
                  props.experimental?.displayBackgroundColorFromImage &&
                    !isPending
                    ? isLight
                      ? "text-dark"
                      : "text-light"
                    : ""
                )}>
                {props.data.item.artists[0].name}
              </p>
            </div>
          </div>
          {props.isSuccess && <ProgressBar {...props} />}
        </HoverCardContent>
      )}
    </HoverCard>
  );
};

const CurrentPlaying: FC<Props> = ({
  children,
  queryOptions,
  className,
  hoverCardContentClassName,
  experimental,
}) => {
  const result = useQuery<CurrentPlaying, HTTPError>({
    refetchInterval: (ctx) => {
      if (
        ctx.state.data?.is_playing &&
        ctx.state.data.item.duration_ms &&
        ctx.state.data.progress_ms
      ) {
        const delta =
          (ctx.state.data.item.duration_ms - ctx.state.data.progress_ms) / 2;
        return delta > 30_000 ? delta : 30_000;
      }
      return 60_000;
    },
    refetchOnWindowFocus: "always",
    ...queryOptions,
    queryKey: ["spotify-current-playing"],
    queryFn: async ({ signal }) => {
      return await serviceRequest()
        .get("spotify/playing", {
          signal,
        })
        .json<CurrentPlaying>();
    },
  });

  if (children) {
    return <>{typeof children === "function" ? children(result) : children}</>;
  }

  if (result.isLoading) {
    return (
      <div
        className={cn(
          "c-bg-third relative line-clamp-1 flex w-fit max-w-[200px] items-center gap-2 rounded-full border-[#FCA5A5]/50 px-4 py-2 text-sm shadow-[0px_0px_15px_4px_rgb(252_165_165_/_0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252_/_0.3)] not-prose",
          className
        )}>
        <span className="i-mdi-spotify size-5 text-[#1DB954]" />
        <div className="c-bg-primary h-5 w-20 animate-pulse rounded-full" />
      </div>
    );
  }

  return (
    <CurrentPlayingContextProvider initValue={result.data?.progress_ms ?? 0}>
      <Card
        {...result}
        className={className}
        hoverCardContentClassName={hoverCardContentClassName}
        experimental={experimental}
      />
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
