"use client";

import { useRef, useState, useCallback, useEffect } from "react";

import { Button, Slider, Spinner } from "@heroui/react";
import { useDebouncer } from "@tanstack/react-pacer";
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";

import { cn } from "../utils/cn.util";

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
}

/** How long the controls stay after the pointer settles while playing. */
const CONTROLS_HIDE_MS = 3000;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const VideoPlayer = ({ src, poster, className }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);

  const hide = useDebouncer(() => setShowControls(false), {
    wait: CONTROLS_HIDE_MS,
  });

  const revealControls = useCallback(() => {
    setShowControls(true);
    hide.maybeExecute();
  }, [hide]);

  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
    revealControls();
  }, [revealControls]);

  const handleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const handleSeek = useCallback(
    (v: number | number[]) => {
      const t =
        /* SAFETY: The producer contract guarantees this value satisfies number. */ v as number;
      if (videoRef.current) videoRef.current.currentTime = t;
      setCurrentTime(t);
      revealControls();
    },
    [revealControls]
  );

  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      void containerRef.current.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("group relative overflow-hidden rounded-lg", className)}
      onMouseMove={revealControls}
      onMouseEnter={revealControls}
      onClick={handlePlayPause}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full"
        onPlay={() => {
          setIsPlaying(true);
          hide.maybeExecute();
        }}
        onPause={() => {
          setIsPlaying(false);
          setShowControls(true);
          hide.cancel();
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
          setShowControls(true);
          hide.cancel();
        }}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => {
          setDuration(videoRef.current?.duration ?? 0);
          setIsLoading(false);
        }}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      <div
        className={cn(
          "absolute right-0 bottom-0 left-0 bg-gradient-to-t  to-transparent px-3 pt-10 pb-2 transition-opacity duration-200",
          showControls ? "opacity-100" : "opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}>
        <Slider
          aria-label="Seek"
          value={currentTime}
          minValue={0}
          maxValue={duration || 0}
          step={0.1}
          onChange={handleSeek}
          className="mb-2 w-full">
          <Slider.Track className="h-1">
            <Slider.Fill />
            <Slider.Thumb className="size-4" />
          </Slider.Track>
        </Slider>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="tertiary"
            isIconOnly
            onPress={handlePlayPause}
            className="opacity-50">
            {isPlaying ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </Button>

          <span className="min-w-[5rem] text-xs text-white/80 tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant="tertiary"
              isIconOnly
              onPress={handleMute}
              className="opacity-50">
              {isMuted ? (
                <VolumeX className="size-4" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </Button>

            <Button
              size="sm"
              variant="tertiary"
              isIconOnly
              onPress={handleFullscreen}
              className="opacity-50">
              {isFullscreen ? (
                <Minimize className="size-4" />
              ) : (
                <Maximize className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
