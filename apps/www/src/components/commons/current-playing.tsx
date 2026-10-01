"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState, useCallback, useTransition } from "react";

import { ProgressBar, Tooltip } from "@heroui/react";
import type { UseQueryResult } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { BorderBeam } from "border-beam";
import { useInterval } from "usehooks-ts";

import Image from "@chia/ui/image";
import Marquee from "@chia/ui/marquee";
import TextShimmer from "@chia/ui/text-shimmer";
import { cn } from "@chia/ui/utils/cn.util";
import { getBrightness } from "@chia/ui/utils/get-brightness";
import { experimental_getImgAverageRGB } from "@chia/ui/utils/get-img-average-rgb";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

type CurrentPlayingResponse = RouterOutputs["spotify"]["playing"];

interface ExtendsProps {
  className?: string;
  tooltipContentClassName?: string;
  experimental?: {
    displayBackgroundColorFromImage?: boolean;
  };
}

interface Props extends ExtendsProps {
  children?:
    | ReactNode
    | ((result: UseQueryResult<CurrentPlayingResponse, Error>) => ReactNode);
  queryOptions?: Parameters<
    typeof orpc.spotify.playing.queryOptions<CurrentPlayingResponse>
  >[0];
}

type NowPlaying = NonNullable<CurrentPlayingResponse>;

const PROGRESS_TICK_MS = 1000;
const IDLE_REFETCH_MS = 60_000;
/** The next track needs a moment to register with Spotify after the last one ends. */
const TRACK_CHANGE_GRACE_MS = 2000;
/** A shared cache may still hold a track that has ended; this keeps refetches from spinning. */
const MIN_REFETCH_MS = 5000;

const progressAt = (nowPlaying: NowPlaying, now: number) =>
  nowPlaying.isPlaying
    ? Math.min(
        nowPlaying.progressMs + now - nowPlaying.observedAt,
        nowPlaying.track.durationMs
      )
    : nowPlaying.progressMs;

/** Refetch as the track should end; the idle cap still catches a skip or pause. */
const refetchIntervalFor = (nowPlaying: CurrentPlayingResponse | undefined) => {
  if (!nowPlaying?.isPlaying) {
    return IDLE_REFETCH_MS;
  }

  const remaining =
    nowPlaying.track.durationMs - progressAt(nowPlaying, Date.now());
  return Math.min(
    Math.max(remaining + TRACK_CHANGE_GRACE_MS, MIN_REFETCH_MS),
    IDLE_REFETCH_MS
  );
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

const TrackProgress = ({ nowPlaying }: { nowPlaying: NowPlaying }) => {
  const [now, setNow] = useState(Date.now);
  useInterval(
    () => setNow(Date.now()),
    nowPlaying.isPlaying ? PROGRESS_TICK_MS : null
  );
  const percentage =
    (progressAt(nowPlaying, now) / (nowPlaying.track.durationMs || 1)) * 100;

  return (
    <ProgressBar aria-label="Playback progress" size="sm" value={percentage}>
      <ProgressBar.Track className="c-bg-gradient-yellow-to-pink">
        <ProgressBar.Fill className="c-bg-gradient-purple-to-pink" />
      </ProgressBar.Track>
    </ProgressBar>
  );
};

const AlbumImage = ({
  data,
  onLoad,
}: {
  data: NowPlaying;
  onLoad: (img: HTMLImageElement) => void;
}) => (
  <Image
    crossOrigin="anonymous"
    width={80}
    height={80}
    sizes="80px"
    onLoad={(e) => onLoad(e.currentTarget)}
    src={data.track.imageUrl ?? ""}
    alt={data.track.album}
    className="m-0 size-20 rounded-2xl bg-gray-400 object-cover"
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
        shouldUseMarquee ? "text-base" : "line-clamp-1 text-lg",
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
        href={data.track.url}
        target="_blank"
        rel="noopener noreferrer">
        <TextShimmer className="m-0 flex w-full p-0">
          {data.track.name} - {data.track.artists[0]}
        </TextShimmer>
      </Link>
    </Marquee>
  );
};

const Card = ({
  data,
  isLoading,
  isSuccess,
  className,
  tooltipContentClassName,
  experimental,
}: UseQueryResult<CurrentPlayingResponse, Error> & ExtendsProps) => {
  const enableColorExtraction =
    experimental?.displayBackgroundColorFromImage ?? false;

  const { bgRGB, isLight, isPending, handleImageLoad } =
    useImageColorExtraction(
      data?.track.imageUrl ?? undefined,
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
    <Tooltip delay={300}>
      <Tooltip.Trigger data-testid="current-playing">
        <BorderBeam
          active={!!data}
          duration={3.5}
          size="pulse-inner"
          theme="light">
          <div
            className={cn(
              "bg-surface prose dark:prose-invert not-prose relative line-clamp-1 flex w-fit max-w-50 items-center gap-2 rounded-full px-4 py-2 text-sm transition-all",
              className
            )}>
            <span className="i-mdi-spotify size-5 text-[#1DB954]" />
            {isLoading ? (
              <div className="c-bg-primary h-5 w-20 animate-pulse rounded-full" />
            ) : (
              <PlayingLink data={data} />
            )}
          </div>
        </BorderBeam>
      </Tooltip.Trigger>

      {data && (
        <Tooltip.Content
          style={{ backgroundColor }}
          className={cn(
            "text-overlay-foreground not-prose z-20 flex h-[150px] w-72 flex-col items-start justify-center gap-4 backdrop-blur-sm",
            (!enableColorExtraction || isPending) &&
              "bg-surface/(--popover-opacity)",
            tooltipContentClassName
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
                name={data.track.name}
                enableColorExtraction={enableColorExtraction}
                isPending={isPending}
                isLight={isLight}
              />
              <p className={cn("mt-0 line-clamp-1 text-sm", textColorClass)}>
                {data.track.artists[0]}
              </p>
            </div>
          </div>
          {isSuccess && <TrackProgress nowPlaying={data} />}
        </Tooltip.Content>
      )}
    </Tooltip>
  );
};

export const LoadingSkeleton = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "c-bg-third border-accent/50 not-prose shadow-glow relative line-clamp-1 flex w-fit max-w-[200px] items-center gap-2 rounded-full px-4 py-2 text-sm transition-all",
      className
    )}>
    <span className="i-mdi-spotify size-5 text-[#1DB954]" />
    <div className="c-bg-primary h-5 w-20 animate-pulse rounded-full" />
  </div>
);

export const CurrentPlaying = ({
  children,
  queryOptions,
  className,
  tooltipContentClassName,
  experimental,
}: Props) => {
  const result = useQuery(
    orpc.spotify.playing.queryOptions({
      ...queryOptions,
      refetchInterval: (ctx) => refetchIntervalFor(ctx.state.data),
      refetchOnWindowFocus: "always",
    })
  );

  if (children) {
    return <>{children instanceof Function ? children(result) : children}</>;
  }

  if (result.isLoading) {
    return <LoadingSkeleton className={className} />;
  }

  return (
    <Card
      {...result}
      className={className}
      tooltipContentClassName={tooltipContentClassName}
      experimental={experimental}
    />
  );
};
