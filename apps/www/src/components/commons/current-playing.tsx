"use client";

import Link from "next/link";
import type { ReactNode, Dispatch, SetStateAction } from "react";
import {
  useState,
  useEffect,
  createContext,
  use,
  useCallback,
  useTransition,
} from "react";

import type { UseQueryResult, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@chia/ui/hover-card";
import Image from "@chia/ui/image";
import Marquee from "@chia/ui/marquee";
import { Progress } from "@chia/ui/progress";
import TextShimmer from "@chia/ui/text-shimmer";
import { cn } from "@chia/ui/utils/cn.util";
import { getBrightness } from "@chia/ui/utils/get-brightness";
import { experimental_getImgAverageRGB } from "@chia/ui/utils/get-img-average-rgb";

import type { HonoRPCError } from "@/libs/service/error";
import type { CurrentPlayingResponse } from "@/services/spotify.service";
import { getCurrentPlaying } from "@/services/spotify.service";

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
    | ((
        result: UseQueryResult<CurrentPlayingResponse, HonoRPCError>
      ) => ReactNode);
  queryOptions?: Omit<
    UseQueryOptions<CurrentPlayingResponse, HonoRPCError>,
    "queryKey" | "queryFn"
  >;
}

const ProgressContext = createContext<
  [number, Dispatch<SetStateAction<number>>] | undefined
>(undefined);

const useProgressContext = () => {
  const context = use(ProgressContext);
  if (!context) {
    throw new Error(
      "useProgressContext must be used within a ProgressProvider"
    );
  }
  return context;
};

const ProgressProvider = ({
  children,
  initialProgress,
}: {
  children: ReactNode;
  initialProgress: number;
}) => {
  const [progress, setProgress] = useState(initialProgress);
  return (
    <ProgressContext value={[progress, setProgress]}>
      {children}
    </ProgressContext>
  );
};

const useProgressTracking = (
  isPlaying: boolean,
  durationMs: number,
  progressMs: number,
  isFetching: boolean,
  isSuccess: boolean,
  refetch: () => Promise<UseQueryResult<CurrentPlayingResponse, HonoRPCError>>
) => {
  const [, setProgress] = useProgressContext();

  // 同步初始進度
  useEffect(() => {
    if (!isFetching && isSuccess && isPlaying) {
      setProgress(progressMs);
    }
  }, [isPlaying, isFetching, isSuccess, progressMs, setProgress]);

  // 更新進度條
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < durationMs) {
          return prev + 1000;
        }
        void refetch();
        return 0;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, durationMs, refetch, setProgress]);
};

const useImageColorExtraction = (
  imageUrl: string | undefined,
  enabled: boolean
) => {
  const [bgRGB, setBgRGB] = useState<number[]>([]);
  const [isLight, setIsLight] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleImageLoad = useCallback(
    (img: HTMLImageElement) => {
      if (!enabled || !imageUrl) return;

      startTransition(() => {
        const rgb = experimental_getImgAverageRGB(img);
        const { isLight: light } = getBrightness(rgb);
        setIsLight(light);
        setBgRGB(rgb);
      });
    },
    [enabled, imageUrl]
  );

  return { bgRGB, isLight, isPending, handleImageLoad };
};

const getTextColorClass = (
  enableColorExtraction: boolean,
  isPending: boolean,
  isLight: boolean
) => {
  if (!enableColorExtraction || isPending) return "";
  return isLight ? "text-dark" : "text-light";
};

const ProgressBar = ({ durationMs }: { durationMs: number }) => {
  const [progress] = useProgressContext();
  const percentage = (progress / (durationMs || 1)) * 100;

  return <Progress value={percentage} className="h-1" />;
};

const AlbumImage = ({
  data,
  onLoad,
}: {
  data: CurrentPlayingResponse;
  onLoad: (img: HTMLImageElement) => void;
}) => (
  <Image
    crossOrigin="anonymous"
    width={80}
    height={80}
    sizes="80px"
    blur={false}
    onLoad={(e) => onLoad(e.target as HTMLImageElement)}
    src={data?.item.album.images[0]?.url ?? ""}
    alt={data?.item.album.name ?? ""}
    className="m-0 size-20 rounded-lg bg-gray-400 object-cover"
  />
);

const SongTitle = ({
  name,
  enableColorExtraction,
  isPending,
  isLight,
}: {
  name: string;
  enableColorExtraction: boolean;
  isPending: boolean;
  isLight: boolean;
}) => {
  const textColorClass = getTextColorClass(
    enableColorExtraction,
    isPending,
    isLight
  );
  const shouldUseMarquee = name.length > 13;

  const titleElement = (
    <h4
      className={cn(
        "mt-0 mb-2",
        shouldUseMarquee ? "text-md" : "line-clamp-1 text-lg",
        textColorClass
      )}>
      {name}
    </h4>
  );

  if (shouldUseMarquee) {
    return (
      <Marquee className="w-full p-0" repeat={2}>
        {titleElement}
      </Marquee>
    );
  }

  return titleElement;
};

const PlayingLink = ({
  data,
}: {
  data: CurrentPlayingResponse | undefined;
}) => {
  if (!data) {
    return <p className="m-0">Not Playing</p>;
  }

  return (
    <Marquee className="w-[85%] p-0" repeat={2} pauseOnHover>
      <Link
        className="m-0 text-sm"
        href={data.item.external_urls.spotify}
        target="_blank"
        rel="noopener noreferrer">
        <TextShimmer className="m-0 flex w-full p-0">
          {data.item.name} - {data.item.artists[0]?.name}
        </TextShimmer>
      </Link>
    </Marquee>
  );
};

const Card = ({
  data,
  isLoading,
  isSuccess,
  isError,
  isFetching,
  refetch,
  className,
  hoverCardContentClassName,
  experimental,
}: UseQueryResult<CurrentPlayingResponse, HonoRPCError> & ExtendsProps) => {
  const enableColorExtraction =
    experimental?.displayBackgroundColorFromImage ?? false;

  useProgressTracking(
    data?.is_playing ?? false,
    data?.item.duration_ms ?? 0,
    data?.progress_ms ?? 0,
    isFetching,
    isSuccess,
    refetch
  );

  const { bgRGB, isLight, isPending, handleImageLoad } =
    useImageColorExtraction(
      data?.item.album.images[0]?.url,
      enableColorExtraction
    );

  const textColorClass = getTextColorClass(
    enableColorExtraction,
    isPending,
    isLight
  );

  const backgroundColor =
    bgRGB.length === 3
      ? `rgba(${bgRGB[0]}, ${bgRGB[1]}, ${bgRGB[2]}, 0.3)`
      : undefined;

  return (
    <HoverCard>
      <HoverCardTrigger asChild className="prose dark:prose-invert z-10">
        <div
          data-testid="current-playing"
          className={cn(
            "c-bg-third border-secondary/50 not-prose relative line-clamp-1 flex w-fit max-w-[200px] items-center gap-2 rounded-full px-4 py-2 text-sm shadow-[0px_0px_15px_4px_rgb(252_165_165/0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252/0.3)]",
            className
          )}>
          <span className="i-mdi-spotify size-5 text-[#1DB954]" />
          {isLoading ? (
            <div className="c-bg-primary h-5 w-20 animate-pulse rounded-full" />
          ) : (
            <PlayingLink data={data} />
          )}
        </div>
      </HoverCardTrigger>
      {data && (
        <HoverCardContent
          style={{ backgroundColor }}
          className={cn(
            "border-secondary/50 not-prose z-20 flex h-[150px] w-72 flex-col items-start justify-center gap-4 shadow-[0px_0px_15px_4px_rgb(252_165_165/0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252/0.3)]",
            isError &&
              "border-danger/50 dark:border-danger/50 shadow-[0px_0px_25px_4px_rgb(244_67_54/0.3)] dark:shadow-[0px_0px_25px_4px_rgb(244_67_54/0.3)]",
            enableColorExtraction && !isPending
              ? "backdrop-blur-lg"
              : "c-bg-third",
            hoverCardContentClassName
          )}>
          <div className="flex items-center gap-5">
            <AlbumImage data={data} onLoad={handleImageLoad} />
            <div
              className={cn(
                "overflow-hidden p-1",
                enableColorExtraction && !isPending
                  ? "not-prose"
                  : "prose dark:prose-invert"
              )}>
              <SongTitle
                name={data.item.name}
                enableColorExtraction={enableColorExtraction}
                isPending={isPending}
                isLight={isLight}
              />
              <p className={cn("mt-0 line-clamp-1 text-sm", textColorClass)}>
                {data.item.artists[0]?.name}
              </p>
            </div>
          </div>
          {isSuccess && <ProgressBar durationMs={data.item.duration_ms} />}
        </HoverCardContent>
      )}
    </HoverCard>
  );
};

export const LoadingSkeleton = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "c-bg-third border-secondary/50 not-prose relative line-clamp-1 flex w-fit max-w-[200px] items-center gap-2 rounded-full px-4 py-2 text-sm shadow-[0px_0px_15px_4px_rgb(252_165_165/0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252/0.3)]",
      className
    )}>
    <span className="i-mdi-spotify size-5 text-[#1DB954]" />
    <div className="c-bg-primary h-5 w-20 animate-pulse rounded-full" />
  </div>
);

const calculateRefetchInterval = (
  data: CurrentPlayingResponse | undefined
): number => {
  if (!data?.is_playing || !data.item.duration_ms || !data.progress_ms) {
    return 60_000;
  }

  const remainingTime = data.item.duration_ms - data.progress_ms;
  const delta = remainingTime / 2;

  return delta > 30_000 ? delta : 30_000;
};

export const CurrentPlaying = ({
  children,
  queryOptions,
  className,
  hoverCardContentClassName,
  experimental,
}: Props) => {
  const result = useQuery<CurrentPlayingResponse, HonoRPCError>({
    queryKey: ["spotify-current-playing"],
    queryFn: getCurrentPlaying,
    refetchInterval: (ctx) => calculateRefetchInterval(ctx.state.data),
    refetchOnWindowFocus: "always",
    ...queryOptions,
  });

  if (children) {
    return <>{typeof children === "function" ? children(result) : children}</>;
  }

  if (result.isLoading) {
    return <LoadingSkeleton className={className} />;
  }

  return (
    <ProgressProvider initialProgress={result.data?.progress_ms ?? 0}>
      <Card
        {...result}
        className={className}
        hoverCardContentClassName={hoverCardContentClassName}
        experimental={experimental}
      />
    </ProgressProvider>
  );
};
