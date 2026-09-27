"use client";

import { Fragment, useEffect, useId, useRef } from "react";

import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";

import { cn } from "@chia/ui/utils/cn.util";

/** A 3×5 block face per character; `#` is a filled cell. */
const FONT = {
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  E: ["###", "#..", "###", "#..", "###"],
  O: ["###", "#.#", "#.#", "#.#", "###"],
  R: ["###", "#.#", "###", "##.", "#.#"],
} as const;

export type Glyph = keyof typeof FONT;

const ROWS = 5;
const UNIT = 32;
const COS30 = Math.cos(Math.PI / 6);

type Vec = readonly [number, number, number];

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const negate = (a: Vec): Vec => [-a[0], -a[1], -a[2]];

/** Isometric projection with +z up; the viewer looks down from +x, +y, +z. */
const project = ([x, y, z]: Vec) =>
  [(x - y) * COS30 * UNIT, ((x + y) / 2 - z) * UNIT] as const;

const point = (vec: Vec) =>
  project(vec)
    .map((value) => Math.round(value * 100) / 100)
    .join(" ");

/** The faces a viewer can see, each spanned by `u` and `v` from the corner at `voxel + normal`. */
const VISIBLE_FACES = [
  { normal: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], hatched: true },
  { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1], hatched: false },
  { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], hatched: false },
] as const satisfies readonly {
  normal: Vec;
  u: Vec;
  v: Vec;
  hatched: boolean;
}[];

interface Face {
  outline: string;
  edges: string;
  hatched: boolean;
}

/**
 * Stands the glyphs upright, reading up and to the right with their faces toward the viewer, and
 * lists the visible faces far to near so later ones cover what they hide. An edge is drawn only
 * where the surface folds or ends, so a letter reads as one solid rather than a pile of cubes.
 */
const buildScene = (glyphs: readonly Glyph[]) => {
  const voxels: Vec[] = [];
  let column = 0;
  for (const glyph of glyphs) {
    FONT[glyph].forEach((row, rowIndex) => {
      [...row].forEach((cell, cellIndex) => {
        if (cell === "#") {
          voxels.push([0, -(column + cellIndex + 1), ROWS - 1 - rowIndex]);
        }
      });
    });
    column += FONT[glyph][0].length + 1;
  }
  const columns = column - 1;

  const occupied = new Set(voxels.map((voxel) => voxel.join()));
  const has = (voxel: Vec) => occupied.has(voxel.join());

  const faces: Face[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  const byDepth = voxels.toSorted(
    (a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2])
  );
  for (const voxel of byDepth) {
    for (const { normal, u, v, hatched } of VISIBLE_FACES) {
      if (has(add(voxel, normal))) continue;
      const origin = add(voxel, normal);
      const corners = [
        origin,
        add(origin, u),
        add(add(origin, u), v),
        add(origin, v),
      ] as const;
      for (const corner of corners) {
        const [x, y] = project(corner);
        xs.push(x);
        ys.push(y);
      }
      const sides = [
        [corners[0], corners[1], negate(v)],
        [corners[1], corners[2], u],
        [corners[2], corners[3], v],
        [corners[3], corners[0], negate(u)],
      ] as const;
      const edges = sides
        .filter(([, , toward]) => {
          const neighbour = add(voxel, toward);
          return !has(neighbour) || has(add(neighbour, normal));
        })
        .map(([from, to]) => `M${point(from)}L${point(to)}`)
        .join("");
      faces.push({
        outline: `M${corners.map(point).join("L")}Z`,
        edges,
        hatched,
      });
    }
  }

  const minX = Math.min(...xs) - 1;
  const minY = Math.min(...ys) - 1;
  const width = Math.max(...xs) + 1 - minX;
  const height = Math.max(...ys) + 1 - minY;
  const guide = (from: Vec, to: Vec) => `M${point(from)}L${point(to)}`;

  return {
    faces,
    viewBox: { x: minX, y: minY, width, height },
    /** Construction lines along the ground: the baseline and the two ends of the word. */
    guides: [
      guide([1, 16, 0], [1, -columns - 16, 0]),
      guide([-16, 0, 0], [16, 0, 0]),
      guide([-16, -columns, 0], [16, -columns, 0]),
    ].join(""),
  };
};

/**
 * Block letters drawn as an isometric line figure: hatched faces, blank sides, hairline edges on
 * dashed construction lines. The edges darken around the pointer.
 */
export const IsometricMark = ({
  glyphs,
  className,
}: {
  glyphs: readonly Glyph[];
  className?: string;
}) => {
  const id = useId();
  const ids = {
    hatch: `isometric-hatch-${id}`,
    glow: `isometric-glow-${id}`,
    mask: `isometric-mask-${id}`,
    scene: `isometric-scene-${id}`,
  };
  const ref = useRef<SVGSVGElement>(null);
  const { faces, viewBox, guides } = buildScene(glyphs);

  const shouldReduceMotion = useReducedMotion();
  const isInView = useInView(ref, { margin: "80px" });
  const pointerX = useMotionValue(viewBox.x + viewBox.width / 2);
  const pointerY = useMotionValue(viewBox.y + viewBox.height / 2);
  const spring = { stiffness: 300, damping: 30, mass: 0.1 };
  const glowX = useSpring(pointerX, spring);
  const glowY = useSpring(pointerY, spring);

  useEffect(() => {
    if (
      shouldReduceMotion ||
      !isInView ||
      window.matchMedia("(hover: none)").matches
    ) {
      return;
    }
    const handlePointerMove = (event: PointerEvent) => {
      const matrix = ref.current?.getScreenCTM()?.inverse();
      if (!matrix) return;
      const { x, y } = new DOMPoint(
        event.clientX,
        event.clientY
      ).matrixTransform(matrix);
      pointerX.set(x);
      pointerY.set(y);
    };
    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [shouldReduceMotion, isInView, pointerX, pointerY]);

  return (
    <svg
      ref={ref}
      aria-hidden
      className={cn(
        "[--mark-edge:color-mix(in_oklab,var(--foreground)_22%,var(--background))] [--mark-hatch:color-mix(in_oklab,var(--foreground)_14%,var(--background))] [--mark-ink:color-mix(in_oklab,var(--foreground)_70%,var(--background))]",
        className
      )}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      preserveAspectRatio="xMinYMax meet"
      fill="none"
      overflow="visible"
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern
          id={ids.hatch}
          width="10"
          height="10"
          patternUnits="userSpaceOnUse">
          <path
            d="M-1 1l2 -2M0 10l10 -10M9 11l2 -2"
            stroke="var(--mark-hatch)"
          />
        </pattern>
        <motion.radialGradient
          id={ids.glow}
          cx={glowX}
          cy={glowY}
          r={Math.max(viewBox.width, viewBox.height) * 0.45}
          gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </motion.radialGradient>
        <mask id={ids.mask} maskUnits="userSpaceOnUse" {...viewBox}>
          <rect {...viewBox} fill={`url(#${ids.glow})`} />
        </mask>
        <g id={ids.scene}>
          {faces.map((face) => (
            <Fragment key={face.outline}>
              <path
                d={face.outline}
                className="fill-background"
                stroke="none"
              />
              {face.hatched && (
                <path
                  d={face.outline}
                  fill={`url(#${ids.hatch})`}
                  stroke="none"
                />
              )}
              <path
                d={face.edges}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </Fragment>
          ))}
        </g>
      </defs>
      <path
        d={guides}
        className="stroke-separator"
        strokeDasharray="4 2"
        vectorEffect="non-scaling-stroke"
      />
      <use href={`#${ids.scene}`} stroke="var(--mark-edge)" />
      <use
        href={`#${ids.scene}`}
        stroke="var(--mark-ink)"
        mask={`url(#${ids.mask})`}
      />
    </svg>
  );
};
