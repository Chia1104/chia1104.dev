"use client";

import { useEffect, useRef } from "react";

import { cn } from "@chia/ui/utils/cn.util";

import {
  BLANK_GLYPH,
  GLYPH_TILES,
  darknessRanksOf,
  densityOfDarkness,
  glyphOfDensity,
  glyphPaletteOf,
  hash,
  inkGlyphAtlas,
  isSameGlyphPalette,
  unit,
} from "./utils/ascii-glyphs";
import type { GlyphPalette } from "./utils/ascii-glyphs";
import useShaderEnvironment from "./utils/use-shader-environment";

export interface AsciiSwapPoint {
  x: number;
  y: number;
}

interface AsciiSwapProps {
  /** Whether `to` is the picture on show. */
  active: boolean;
  /** Point in the box the next change spreads from; `null` is its middle. */
  origin: AsciiSwapPoint | null;
  /** The picture the box shows by itself, under this layer. Only its glyphs are drawn, on the way back. */
  from: ImageBitmap | null;
  /** The picture swapped in. Nothing happens until it is here. */
  to: ImageBitmap | null;
  /** Swaps at once, as it does under the system's reduced-motion setting. */
  reducedMotion?: boolean;
  className?: string;
}

/** The box shows through: the picture under this layer. */
const CLEAR = -1;
/** Forces the next frame to repaint a cell whatever it holds. */
const STALE = -2;
/** The cell shows its part of the picture swapped in. */
const PHOTO = -3;

const SWAP_MS = 520;
/** Width of the band of glyphs, as a share of the longest distance the wave travels. */
const BAND = 0.5;
/** The share of the band, from its leading edge, that flickers in the accent colour. */
const LIT = 0.4;
/** How far a cell's turn is moved off its true distance, which breaks the edge into a dither. */
const JITTER = 0.08;
/** How often a glyph on the lit edge is redrawn. */
const TICK_MS = 64;
/** Glyphs the lit edge flickers through: the dense half of the ramp. */
const LIT_GLYPHS = 5;
/** Cells along the shorter side of the box, where its size allows. */
const CELLS = 16;
const MIN_CELL = 4;
const MAX_CELL = 8;
const MAX_PIXEL_RATIO = 2;

const easeInOutQuad = (progress: number) =>
  progress < 0.5 ? 2 * progress ** 2 : 1 - (-2 * progress + 2) ** 2 / 2;

/**
 * The swap as plain state over a 2D canvas the size of its box. A wave of glyphs crosses the box:
 * ahead of it the canvas is clear, behind it each cell holds its part of the picture swapped in.
 * `turn` is how far the swap has gone, so leaving halfway runs the same wave backwards.
 */
const createSwap = (canvas: HTMLCanvasElement, probe: HTMLElement) => {
  const context = canvas.getContext("2d");
  const atlas = document.createElement("canvas");
  const sampler = document.createElement("canvas");
  const photo = document.createElement("canvas");
  const style = getComputedStyle(probe);

  let columns = 0;
  let rows = 0;
  let cellPixels = 0;
  let width = 0;
  let height = 0;
  let reach = new Float32Array(0);
  let fromLevel = new Uint8Array(0);
  let toLevel = new Uint8Array(0);
  let drawn = new Int16Array(0);
  let palette: GlyphPalette | null = null;
  let from: ImageBitmap | null = null;
  let to: ImageBitmap | null = null;
  let wanted = false;
  let instant = false;
  let origin: AsciiSwapPoint | null = null;
  /** Where the next swap is to spread from; taken up once one starts from rest. */
  let asked: AsciiSwapPoint | null = null;
  /** 0 shows the box's own picture, 1 the one swapped in. */
  let turn = 0;
  let last = 0;
  let frame = 0;

  const goal = () => (wanted && to ? 1 : 0);

  const levelsOf = (image: ImageBitmap | null) => {
    const levels = new Uint8Array(columns * rows).fill(BLANK_GLYPH);
    const ranks = image ? darknessRanksOf(sampler, image, columns, rows) : null;
    if (!ranks) return levels;
    for (let index = 0; index < levels.length; index++) {
      levels[index] = glyphOfDensity(densityOfDarkness(ranks[index] ?? 0));
    }
    return levels;
  };

  /** The picture swapped in at the canvas's own size, cropped to fill, so a cell is a plain copy. */
  const develop = () => {
    const photoContext = photo.getContext("2d");
    photo.width = canvas.width;
    photo.height = canvas.height;
    if (!photoContext || !to || canvas.width === 0 || canvas.height === 0) {
      return;
    }
    const scale = Math.max(canvas.width / to.width, canvas.height / to.height);
    const drawnWidth = to.width * scale;
    const drawnHeight = to.height * scale;
    photoContext.imageSmoothingQuality = "high";
    photoContext.drawImage(
      to,
      (canvas.width - drawnWidth) / 2,
      (canvas.height - drawnHeight) / 2,
      drawnWidth,
      drawnHeight
    );
  };

  const settle = () => {
    fromLevel = levelsOf(from);
    toLevel = levelsOf(to);
    develop();
    drawn.fill(STALE);
  };

  /**
   * Each cell's turn in the wave: its distance from the origin, as a share of the longest one.
   * On the way back the order is inverted, so the cells nearest the origin are the first to return.
   */
  const aim = (returning: boolean) => {
    const start = origin ?? { x: width / 2, y: height / 2 };
    const longest = Math.max(
      Math.hypot(start.x, start.y),
      Math.hypot(width - start.x, start.y),
      Math.hypot(start.x, height - start.y),
      Math.hypot(width - start.x, height - start.y),
      1
    );
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const index = row * columns + column;
        const distance =
          Math.hypot(
            ((column + 0.5) / columns) * width - start.x,
            ((row + 0.5) / rows) * height - start.y
          ) / longest;
        const turnAt = Math.min(
          1,
          Math.max(0, distance + (unit(index, 7) - 0.5) * 2 * JITTER)
        );
        reach[index] = returning ? 1 - turnAt : turnAt;
      }
    }
  };

  const layout = () => {
    const box = canvas.parentElement ?? canvas;
    width = box.clientWidth;
    height = box.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const cell = Math.min(
      MAX_CELL,
      Math.max(MIN_CELL, Math.round(Math.min(width, height) / CELLS))
    );
    columns = Math.max(1, Math.round(width / cell));
    rows = Math.max(1, Math.round(height / cell));
    cellPixels = Math.max(1, Math.ceil((width * ratio) / columns));
    canvas.width = columns * cellPixels;
    canvas.height = rows * cellPixels;
    reach = new Float32Array(columns * rows);
    drawn = new Int16Array(columns * rows).fill(STALE);
    palette = null;
    aim(turn > 0.5);
    settle();
  };

  /** Follows the probe's colours, so glyphs are inked in the theme of the page they are on. */
  const tint = () => {
    const next = glyphPaletteOf(style);
    if (isSameGlyphPalette(palette, next)) return;
    palette = next;
    inkGlyphAtlas(atlas, cellPixels, next);
    for (let index = 0; index < drawn.length; index++) {
      if ((drawn[index] ?? CLEAR) >= 0) drawn[index] = STALE;
    }
  };

  const draw = (now: number) => {
    if (!context) return;
    const target = goal();
    const elapsed = now - last;
    last = now;
    if (instant) {
      turn = target;
    } else if (turn < target) {
      turn = Math.min(target, turn + elapsed / SWAP_MS);
    } else if (turn > target) {
      turn = Math.max(target, turn - elapsed / SWAP_MS);
    }
    const moving = turn !== target;
    // Glyphs are only on screen mid-swap, which is the only time the atlas is needed.
    if (moving) tint();
    const head = easeInOutQuad(turn) * (1 + BAND + JITTER);
    const tick = Math.floor(now / TICK_MS);
    for (let index = 0; index < drawn.length; index++) {
      const passed = (head - (reach[index] ?? 0)) / BAND;
      let tile: number;
      if (passed <= 0) {
        tile = CLEAR;
      } else if (passed >= 1) {
        tile = PHOTO;
      } else {
        // The band leads with its lit edge whichever way the wave is going.
        const lead = target === 1 ? passed : 1 - passed;
        tile =
          lead < LIT
            ? GLYPH_TILES + (hash(index, tick) % LIT_GLYPHS)
            : ((target === 1 ? toLevel : fromLevel)[index] ?? BLANK_GLYPH);
      }
      if (tile === drawn[index]) continue;
      drawn[index] = tile;
      const x = (index % columns) * cellPixels;
      const y = Math.floor(index / columns) * cellPixels;
      if (tile === CLEAR) {
        context.clearRect(x, y, cellPixels, cellPixels);
      } else if (tile === PHOTO) {
        context.drawImage(
          photo,
          x,
          y,
          cellPixels,
          cellPixels,
          x,
          y,
          cellPixels,
          cellPixels
        );
      } else {
        context.drawImage(
          atlas,
          (tile % GLYPH_TILES) * cellPixels,
          Math.floor(tile / GLYPH_TILES) * cellPixels,
          cellPixels,
          cellPixels,
          x,
          y,
          cellPixels,
          cellPixels
        );
      }
    }
    if (moving) frame = requestAnimationFrame(draw);
  };

  const run = () => {
    cancelAnimationFrame(frame);
    last = performance.now();
    frame = requestAnimationFrame(draw);
  };

  /** A swap interrupted halfway turns back along the wave it came on; one from rest takes a new origin. */
  const retarget = (before: number) => {
    if (goal() === before || turn !== before) return;
    origin = asked;
    aim(goal() === 0);
  };

  layout();

  return {
    set(next: {
      active: boolean;
      origin: AsciiSwapPoint | null;
      instant: boolean;
    }) {
      const before = goal();
      wanted = next.active;
      instant = next.instant;
      asked = next.origin;
      retarget(before);
      run();
    },
    pictures(nextFrom: ImageBitmap | null, nextTo: ImageBitmap | null) {
      const before = goal();
      from = nextFrom;
      to = nextTo;
      settle();
      retarget(before);
      run();
    },
    resize() {
      layout();
      run();
    },
    destroy() {
      cancelAnimationFrame(frame);
    },
  };
};

/**
 * Swaps the picture in its box for another through a wave of glyphs. It lies over the box, which
 * must be positioned and shows its own picture underneath: the wave spreads from `origin`,
 * drawing `to` first in characters and then in full, and runs back the same way when `active`
 * ends.
 *
 * Both pictures arrive decoded, so the first swap costs no more than any other.
 */
export const AsciiSwap = ({
  active,
  origin,
  from,
  to,
  reducedMotion = false,
  className,
}: AsciiSwapProps) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const swap = useRef<ReturnType<typeof createSwap> | null>(null);
  const { reduceMotion } = useShaderEnvironment();
  const instant = reduceMotion || reducedMotion;

  useEffect(() => {
    const box = canvas.current?.parentElement;
    if (!canvas.current || !probe.current || !box) return;
    const instance = createSwap(canvas.current, probe.current);
    swap.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(box);
    return () => {
      observer.disconnect();
      instance.destroy();
      swap.current = null;
    };
  }, []);

  useEffect(() => {
    swap.current?.pictures(from, to);
  }, [from, to]);

  useEffect(() => {
    swap.current?.set({ active, origin, instant });
  }, [active, origin, instant]);

  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}>
      {/* Paints nothing; its computed colours are what the glyphs are drawn with. */}
      <span
        ref={probe}
        className="bg-background text-foreground outline-accent absolute size-0 font-mono"
      />
      <canvas ref={canvas} className="block size-full" />
    </span>
  );
};
