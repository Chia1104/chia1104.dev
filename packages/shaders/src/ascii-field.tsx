"use client";

import { lazy, Suspense, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@chia/ui/utils/cn.util";

import useShaderEnvironment from "./utils/use-shader-environment";

/** A static import would put the whole shader runtime in the initial scripts of every page that renders this. */
const AsciiFieldLayer = lazy(() => import("./ascii-field-layer"));

/**
 * Dense to sparse: the first glyph draws the brightest cells, the last the darkest. The ramp ends
 * on a dot rather than a space, so even the darkest cell keeps the grid visible.
 */
const DEFAULT_CHARACTERS = "80o();:~-.";

export const AsciiFieldStatus = {
  Pending: "pending",
  Ready: "ready",
  Unavailable: "unavailable",
} as const;

export type AsciiFieldStatus =
  (typeof AsciiFieldStatus)[keyof typeof AsciiFieldStatus];

interface AsciiFieldProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * The picture the glyphs resolve into; `null` leaves the drifting noise. The shader reads its
   * pixels, so the URL must be same-origin, a blob, or served with CORS.
   */
  image: string | null;
  /** `#rrggbb` the glyphs are inked in; the field is transparent between them. */
  color: string;
  characters?: string;
  /** Glyph cell in pixels at a 1080p canvas; the library scales it with the canvas. */
  cellSize?: number;
  /**
   * Most canvas pixels drawn per CSS pixel. The field is texture behind a page: at 1.5 the
   * glyphs still read as characters on a high-density screen for about half the pixels of 2.
   */
  maxDensity?: number;
  /** Stops the field's loop and hides its trail; a new `image` or `color` still redraws it once. */
  paused?: boolean;
  /** Renders as it does under the system's reduced-motion setting: no drift, no trail, no fades. */
  reducedMotion?: boolean;
  /** Told once the shader either paints or cannot run here, so the consumer can show a fallback. */
  onStatusChange?: (status: AsciiFieldStatus) => void;
}

/**
 * A field of glyphs: noise that drifts, a trail under the pointer, and `image` drawn through the
 * same characters. It redraws only while the reader is active and holds its last frame
 * otherwise. Renders nothing until the page is idle, and nothing at all where WebGPU is missing.
 */
export const AsciiField = ({
  image,
  color,
  characters = DEFAULT_CHARACTERS,
  cellSize = 14,
  maxDensity = 1.5,
  paused = false,
  reducedMotion = false,
  onStatusChange,
  className,
  ...props
}: AsciiFieldProps) => {
  const { canRender, reduceMotion } = useShaderEnvironment();
  const [status, setStatus] = useState<AsciiFieldStatus>(
    AsciiFieldStatus.Pending
  );
  const report = (next: AsciiFieldStatus) => {
    setStatus(next);
    onStatusChange?.(next);
  };

  return (
    <div
      {...props}
      aria-hidden
      className={cn("pointer-events-none overflow-hidden", className)}>
      {canRender && status !== AsciiFieldStatus.Unavailable ? (
        <Suspense fallback={null}>
          <AsciiFieldLayer
            image={image}
            color={color}
            characters={characters}
            cellSize={cellSize}
            maxDensity={maxDensity}
            animating={!reduceMotion && !reducedMotion}
            paused={paused}
            onReady={() => report(AsciiFieldStatus.Ready)}
            onUnavailable={() => report(AsciiFieldStatus.Unavailable)}
          />
        </Suspense>
      ) : null}
    </div>
  );
};
