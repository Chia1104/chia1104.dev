"use client";

import { useEffect, useEffectEvent, useRef } from "react";

import { cn } from "@chia/ui/utils/cn.util";

export const AsciiCurtainPhase = {
  /** Glyphs spread from the origin until they cover the viewport, then hold. */
  Cover: "cover",
  /** The cover opens from the origin until nothing is left. */
  Reveal: "reveal",
} as const;

export type AsciiCurtainPhase =
  (typeof AsciiCurtainPhase)[keyof typeof AsciiCurtainPhase];

export interface AsciiCurtainPoint {
  x: number;
  y: number;
}

interface AsciiCurtainProps {
  phase: AsciiCurtainPhase;
  /** Viewport point the current phase spreads from. */
  origin: AsciiCurtainPoint;
  /** Drawn through the glyphs in the middle of the cover; `null` leaves the sparse field. */
  image: ImageBitmap | null;
  /** Called once when `phase` has run its course. A finished cover keeps holding. */
  onPhaseEnd: (phase: AsciiCurtainPhase) => void;
  className?: string;
}

/** Dense to sparse, the ramp `AsciiField` draws with. */
const RAMP = "80o();:~-.";
/** A covered cell with no glyph in it. */
const BLANK = RAMP.length;
const TILES = RAMP.length + 1;
const CLEAR = -1;
/** Forces the next frame to repaint a cell whatever it holds. */
const STALE = -2;

const PHASE_MS = {
  [AsciiCurtainPhase.Cover]: 600,
  [AsciiCurtainPhase.Reveal]: 700,
} as const;
/** Width of the lit edge of the wave, as a share of the longest distance it travels. */
const FRONT = 0.2;
/** How far a cell's turn is moved off its true distance, which breaks the edge into a dither. */
const JITTER = 0.06;
/** How often a glyph on the lit edge is redrawn. */
const TICK_MS = 64;
/** Glyphs the lit edge flickers through: the dense half of the ramp. */
const FRONT_GLYPHS = 5;
/** Side of the picture as a share of the shorter side of the viewport. */
const PICTURE_SHARE = 0.92;
/** Above 1, only the picture's darker half takes the heavy glyphs. */
const PICTURE_GAMMA = 1.5;
const MAX_PIXEL_RATIO = 2;

const hash = (a: number, b: number) => {
  let value =
    Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^
    Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  value ^= value >>> 15;
  value = Math.imul(value, 0x2c1b3c6d);
  value ^= value >>> 12;
  return value >>> 0;
};

const unit = (a: number, b: number) => (hash(a, b) % 4096) / 4096;

const easeOutQuad = (progress: number) => 1 - (1 - progress) ** 2;
const easeInOutQuad = (progress: number) =>
  progress < 0.5 ? 2 * progress ** 2 : 1 - (-2 * progress + 2) ** 2 / 2;

/** Small enough that the picture keeps its features, large enough that a glyph stays a glyph. */
const cellSizeOf = (width: number, height: number) =>
  Math.min(16, Math.max(8, Math.ceil(Math.max(width, height) / 150)));

interface Palette {
  ink: string;
  paper: string;
  accent: string;
  font: string;
}

/**
 * The curtain as plain state over a 2D canvas. Every cell is one opaque tile copied from an atlas,
 * and a frame only touches the cells whose tile changed, so the cost follows the wave's edge, not
 * the size of the screen.
 */
const createCurtain = (
  canvas: HTMLCanvasElement,
  probe: HTMLElement,
  onPhaseEnd: (phase: AsciiCurtainPhase) => void
) => {
  const context = canvas.getContext("2d");
  const atlas = document.createElement("canvas");
  const atlasContext = atlas.getContext("2d");
  const sampler = document.createElement("canvas");
  const samplerContext = sampler.getContext("2d");
  const style = getComputedStyle(probe);

  let columns = 0;
  let rows = 0;
  let cellPixels = 0;
  let reach = new Float32Array(0);
  let level = new Uint8Array(0);
  let drawn = new Int16Array(0);
  let palette: Palette | null = null;
  let image: ImageBitmap | null = null;
  let origin: AsciiCurtainPoint = { x: 0, y: 0 };
  let phase: AsciiCurtainPhase = AsciiCurtainPhase.Cover;
  let phaseStart = performance.now();
  let phaseEnded = false;
  let frame = 0;

  /**
   * How dark the picture is per cell of a `side`-cell square, as each cell's rank among them.
   * Ranking spreads any picture over the whole ramp, however narrow its own range of tones.
   */
  const pictureOf = (side: number) => {
    if (!image || !samplerContext || side < 4) return null;
    sampler.width = side;
    sampler.height = side;
    samplerContext.drawImage(image, 0, 0, side, side);
    const { data } = samplerContext.getImageData(0, 0, side, side);
    const tones = new Uint8Array(side * side);
    const below = new Float32Array(257);
    for (let index = 0; index < tones.length; index++) {
      const tone = Math.round(
        0.2126 * (data[index * 4] ?? 0) +
          0.7152 * (data[index * 4 + 1] ?? 0) +
          0.0722 * (data[index * 4 + 2] ?? 0)
      );
      tones[index] = tone;
      below[tone + 1] = (below[tone + 1] ?? 0) + 1;
    }
    for (let tone = 1; tone < below.length; tone++) {
      below[tone] = (below[tone] ?? 0) + (below[tone - 1] ?? 0);
    }
    return Float32Array.from(
      tones,
      (tone) => 1 - (below[tone + 1] ?? 0) / tones.length
    );
  };

  /**
   * The glyph each covered cell settles on: the picture inside its disc, a sparse field around it.
   * The picture is drawn by its darks in either theme, the way a pen would: brightness as density
   * turns a portrait on a light ground into one solid disc.
   */
  const settle = () => {
    const side = Math.floor(Math.min(columns, rows) * PICTURE_SHARE);
    const picture = pictureOf(side);
    const left = Math.floor((columns - side) / 2);
    const top = Math.floor((rows - side) / 2);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const index = row * columns + column;
        const scatter = unit(index, 3);
        // Four cells in five of the field stay empty; the rest take the lightest glyphs.
        let density = scatter < 0.8 ? 0 : 0.08 + (scatter - 0.8) * 1.2;
        const x = column - left;
        const y = row - top;
        if (picture && x >= 0 && y >= 0 && x < side && y < side) {
          const radius =
            Math.hypot(x + 0.5 - side / 2, y + 0.5 - side / 2) / (side / 2);
          // Fades the picture's disc into the field over its outer fifth.
          const inside = Math.min(1, Math.max(0, (1 - radius) / 0.2));
          const darkness = (picture[y * side + x] ?? 0) ** PICTURE_GAMMA;
          density = density * (1 - inside) + darkness * inside;
        }
        level[index] =
          density < 0.06
            ? BLANK
            : Math.round((1 - density) * (RAMP.length - 1));
        drawn[index] = drawn[index] === CLEAR ? CLEAR : STALE;
      }
    }
  };

  /** Each cell's turn in the wave: its distance from the origin, as a share of the longest one. */
  const aim = () => {
    const { clientWidth: width, clientHeight: height } =
      canvas.parentElement ?? canvas;
    const cell = cellSizeOf(width, height);
    const longest = Math.max(
      Math.hypot(origin.x, origin.y),
      Math.hypot(width - origin.x, origin.y),
      Math.hypot(origin.x, height - origin.y),
      Math.hypot(width - origin.x, height - origin.y),
      1
    );
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const index = row * columns + column;
        const distance =
          Math.hypot(
            (column + 0.5) * cell - origin.x,
            (row + 0.5) * cell - origin.y
          ) / longest;
        reach[index] = Math.min(
          1,
          Math.max(0, distance + (unit(index, 7) - 0.5) * 2 * JITTER)
        );
      }
    }
  };

  const layout = () => {
    const { clientWidth: width, clientHeight: height } =
      canvas.parentElement ?? canvas;
    const cell = cellSizeOf(width, height);
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    // Whether a wave has passed is all a resized grid can keep of what was drawn.
    const wasCovered = drawn.some((tile) => tile !== CLEAR);
    columns = Math.ceil(width / cell);
    rows = Math.ceil(height / cell);
    cellPixels = Math.round(cell * ratio);
    canvas.width = columns * cellPixels;
    canvas.height = rows * cellPixels;
    canvas.style.width = `${columns * cell}px`;
    canvas.style.height = `${rows * cell}px`;
    reach = new Float32Array(columns * rows);
    level = new Uint8Array(columns * rows);
    drawn = new Int16Array(columns * rows).fill(wasCovered ? STALE : CLEAR);
    palette = null;
    aim();
    settle();
  };

  /** One tile per glyph in each colour, already on the paper, so a cell is a single copy. */
  const ink = (next: Palette) => {
    if (!atlasContext) return;
    atlas.width = TILES * cellPixels;
    atlas.height = 2 * cellPixels;
    atlasContext.fillStyle = next.paper;
    atlasContext.fillRect(0, 0, atlas.width, atlas.height);
    atlasContext.font = `600 ${Math.round(cellPixels * 0.9)}px ${next.font}`;
    atlasContext.textAlign = "center";
    atlasContext.textBaseline = "middle";
    for (const [row, color] of [next.ink, next.accent].entries()) {
      atlasContext.fillStyle = color;
      for (const [tile, glyph] of [...RAMP].entries()) {
        atlasContext.fillText(
          glyph,
          (tile + 0.5) * cellPixels,
          (row + 0.5) * cellPixels
        );
      }
    }
  };

  /** Follows the probe's colours, which ease when the page under the curtain changes theme. */
  const tint = () => {
    const next: Palette = {
      ink: style.color,
      paper: style.backgroundColor,
      accent: style.outlineColor,
      font: style.fontFamily,
    };
    if (
      palette?.ink === next.ink &&
      palette.paper === next.paper &&
      palette.accent === next.accent
    ) {
      return;
    }
    palette = next;
    ink(next);
    for (let index = 0; index < drawn.length; index++) {
      if (drawn[index] !== CLEAR) drawn[index] = STALE;
    }
  };

  const draw = (now: number) => {
    if (!context) return;
    tint();
    const progress = Math.min(1, (now - phaseStart) / PHASE_MS[phase]);
    const covering = phase === AsciiCurtainPhase.Cover;
    const head =
      (covering ? easeOutQuad(progress) : easeInOutQuad(progress)) *
      (1 + FRONT + JITTER);
    const tick = Math.floor(now / TICK_MS);
    for (let index = 0; index < drawn.length; index++) {
      const passed = (head - (reach[index] ?? 0)) / FRONT;
      let tile: number;
      if (passed > 0 && passed < 1) {
        tile = TILES + (hash(index, tick) % FRONT_GLYPHS);
      } else if (passed <= 0 === covering) {
        tile = CLEAR;
      } else {
        tile = level[index] ?? BLANK;
        // Now and then a settled glyph slips one step along the ramp, so a held cover is not a still.
        if (tile < RAMP.length - 1 && hash(index, tick >> 2) % 37 === 0) {
          tile += 1;
        }
      }
      if (tile === drawn[index]) continue;
      drawn[index] = tile;
      const x = (index % columns) * cellPixels;
      const y = Math.floor(index / columns) * cellPixels;
      if (tile === CLEAR) {
        context.clearRect(x, y, cellPixels, cellPixels);
      } else {
        context.drawImage(
          atlas,
          (tile % TILES) * cellPixels,
          Math.floor(tile / TILES) * cellPixels,
          cellPixels,
          cellPixels,
          x,
          y,
          cellPixels,
          cellPixels
        );
      }
    }
    if (progress === 1 && !phaseEnded) {
      phaseEnded = true;
      onPhaseEnd(phase);
    }
    // A finished cover keeps drawing: its glyphs shimmer and its colours may still be easing.
    if (covering || progress < 1) frame = requestAnimationFrame(draw);
  };

  const run = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  };

  layout();
  run();

  return {
    start(nextPhase: AsciiCurtainPhase, nextOrigin: AsciiCurtainPoint) {
      phase = nextPhase;
      origin = nextOrigin;
      phaseStart = performance.now();
      phaseEnded = false;
      aim();
      run();
    },
    picture(next: ImageBitmap | null) {
      image = next;
      settle();
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
 * A full-viewport wipe made of glyphs: a wave of characters spreads from a point until the screen
 * is covered, holds while `image` shows through them, then opens again from a point. Whatever
 * sits under it can be swapped while it holds.
 *
 * Colours come from the theme at paint time, so a cover held across a theme change eases from
 * one palette to the other. It always animates; a consumer honouring reduced motion should not
 * mount it.
 */
export const AsciiCurtain = ({
  phase,
  origin,
  image,
  onPhaseEnd,
  className,
}: AsciiCurtainProps) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const curtain = useRef<ReturnType<typeof createCurtain> | null>(null);
  const reportPhaseEnd = useEffectEvent(onPhaseEnd);

  useEffect(() => {
    if (!canvas.current || !probe.current) return;
    const instance = createCurtain(canvas.current, probe.current, (ended) =>
      reportPhaseEnd(ended)
    );
    curtain.current = instance;
    const resize = () => instance.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      instance.destroy();
      curtain.current = null;
    };
  }, []);

  useEffect(() => {
    curtain.current?.start(phase, origin);
  }, [phase, origin]);

  useEffect(() => {
    curtain.current?.picture(image);
  }, [image]);

  return (
    <div aria-hidden className={cn("overflow-hidden", className)}>
      {/* Paints nothing; its computed colours are what the canvas draws with. */}
      <span
        ref={probe}
        className="bg-background text-foreground outline-accent pointer-events-none absolute size-0 font-mono transition-colors duration-300"
      />
      <canvas ref={canvas} className="absolute top-0 left-0 block" />
    </div>
  );
};
