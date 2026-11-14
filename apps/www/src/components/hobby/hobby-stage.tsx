"use client";

import { useEffect, useState } from "react";

import { parseColor } from "@heroui/react";

import { AsciiField, AsciiFieldStatus } from "@chia/shaders/ascii-field";
import { cn } from "@chia/ui/utils/cn.util";
import useTheme, { Theme } from "@chia/ui/utils/use-theme";

import { env } from "@/env";
import cloudflareImageLoader from "@/libs/image-loader";
import { HOBBY_IDLE_COLOR } from "@/shared/media";
import { useHobbyStore } from "@/stores/hobby/store";

/** Moving the pointer down the list crosses rows faster than this; only a row it rests on takes the stage. */
const FOCUS_SETTLE_MS = 140;
/** The field is a backdrop behind text, so a picture this wide is already more than it resolves. */
const BACKDROP_WIDTH = 1600;
const MEDIA_COLOR_PROPERTY = "--media-color";

/**
 * The colour the brightest glyphs are drawn in: the work's hue at a lightness that leaves the
 * page's own text readable over it.
 */
const toneOf = (color: string, isDark: boolean) => {
  const hsl = parseColor(color).toFormat("hsl");
  return hsl
    .withChannelValue(
      "saturation",
      Math.min(70, Math.max(35, hsl.getChannelValue("saturation")))
    )
    .withChannelValue("lightness", isDark ? 44 : 60)
    .toString("hex");
};

/** `/cdn-cgi/image` exists only on the production zone; elsewhere the storage URL is read as is. */
const backdropSourceOf = (url: string) =>
  env.NEXT_PUBLIC_ENV === "production"
    ? cloudflareImageLoader({ src: url, width: BACKDROP_WIDTH, quality: 70 })
    : url;

/**
 * The backdrop as a blob URL, or `null` until it has loaded. Fetched here rather than by the
 * shader so the request can drop its referrer, which storage refuses from other origins, and so a
 * picture that fails leaves the field on its noise.
 */
const useBackdrop = (url: string | null) => {
  const [loaded, setLoaded] = useState<{ url: string; blob: string } | null>(
    null
  );

  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    let blob: string | undefined;
    fetch(backdropSourceOf(url), {
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        blob = URL.createObjectURL(await response.blob());
        setLoaded({ url, blob });
      })
      .catch(() => {
        // Aborted by the next focus, or offline: the field keeps its noise.
      });
    return () => {
      controller.abort();
      if (blob) URL.revokeObjectURL(blob);
    };
  }, [url]);

  return loaded !== null && loaded.url === url ? loaded.blob : null;
};

/** Follows the store a beat late, so a pointer sweeping the list does not start a fetch per row. */
const useSettledFocus = () => {
  const focus = useHobbyStore((state) => state.focus);
  const [settled, setSettled] = useState(focus);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(focus), FOCUS_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [focus]);

  return settled;
};

/**
 * The hobby mode's backdrop: one field of glyphs behind the whole page. It draws the key art of
 * the work in focus and hands that work's colour to the theme through `--media-color`, which is
 * set on `<html>` so layers portalled to `<body>` follow.
 */
export const HobbyStage = () => {
  const { resolvedTheme } = useTheme();
  const focus = useSettledFocus();
  const color = focus?.color ?? null;
  const backdrop = useBackdrop(focus?.backdropUrl ?? null);
  const [status, setStatus] = useState<AsciiFieldStatus>(
    AsciiFieldStatus.Pending
  );
  const isDark = resolvedTheme === Theme.Dark;

  useEffect(() => {
    const { style } = document.documentElement;
    if (color === null) {
      style.removeProperty(MEDIA_COLOR_PROPERTY);
    } else {
      style.setProperty(MEDIA_COLOR_PROPERTY, color);
    }
    return () => {
      style.removeProperty(MEDIA_COLOR_PROPERTY);
    };
  }, [color]);

  return (
    // The one surface that eases when the work in focus changes; the tokens themselves snap.
    <div
      aria-hidden
      className="bg-background pointer-events-none fixed inset-0 -z-1 transition-colors duration-500 motion-reduce:transition-none">
      {/* Where the shader cannot run, the key art itself stands in, washed back towards the page. */}
      {status === AsciiFieldStatus.Unavailable && backdrop ? (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 saturate-50"
          style={{ backgroundImage: `url(${backdrop})` }}
        />
      ) : null}
      <AsciiField
        image={backdrop}
        color={toneOf(color ?? HOBBY_IDLE_COLOR, isDark)}
        cellSize={10}
        onStatusChange={setStatus}
        className={cn(
          "absolute inset-0 transition-opacity duration-700",
          status === AsciiFieldStatus.Ready ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
};
