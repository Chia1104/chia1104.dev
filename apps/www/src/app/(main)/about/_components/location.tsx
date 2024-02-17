"use client";

import createGlobe, { type COBEOptions } from "cobe";
import {
  type ComponentPropsWithoutRef,
  type FC,
  useRef,
  useEffect,
} from "react";
import { cn, useDarkMode } from "@chia/ui";
import { useResizeObserver } from "usehooks-ts";
import { useSpring, useMotionValue } from "framer-motion";

type LocationProps = {
  location: [number, number];
  width: number | string;
  height: number | string;
  defaultPositionOffset?: [number, number];
  enableYInteraction?: boolean;
  cobeOptions?: Omit<Partial<COBEOptions>, "width" | "height" | "onRender">;
} & Omit<ComponentPropsWithoutRef<"canvas">, "width" | "height">;

const Location: FC<LocationProps> = ({
  className,
  location,
  defaultPositionOffset = [0.1, 2.75],
  enableYInteraction,
  cobeOptions = {},
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerXInteracting = useRef<number | null>(null);
  const pointerYInteracting = useRef<number | null>(null);
  const pointerXInteractionMovement = useRef(0);
  const pointerYInteractionMovement = useRef(0);
  const { width, height } = useResizeObserver({
    ref: canvasRef,
    box: "border-box",
  });
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x);
  const springY = useSpring(y);
  const { isDarkMode } = useDarkMode();
  useEffect(() => {
    if (canvasRef.current && width && height) {
      const globe = createGlobe(canvasRef.current, {
        devicePixelRatio: 2,
        phi: 0,
        theta: -0.1,
        diffuse: 2,
        mapSamples: 36_000,
        mapBrightness: 2,
        baseColor: [0.8, 0.8, 0.8],
        markerColor: [235 / 255, 35 / 255, 35 / 255],
        glowColor: [0.5, 0.5, 0.5],
        scale: 1.05,
        dark: isDarkMode ? 1 : 0,
        ...cobeOptions,
        markers: [{ size: 0.1, ...cobeOptions.markers, location }],
        width: width * 2,
        height: width * 2,
        onRender: (state) => {
          state.phi = defaultPositionOffset[1] + springX.get();
          state.theta = enableYInteraction
            ? defaultPositionOffset[0] + springY.get()
            : defaultPositionOffset[0];
          state.width = width * 2;
          state.height = width * 2;
        },
      });

      return () => {
        globe.destroy();
      };
    }
  }, [
    width,
    height,
    springX,
    springY,
    isDarkMode,
    location,
    enableYInteraction,
    defaultPositionOffset,
    cobeOptions,
  ]);
  return (
    <canvas
      ref={canvasRef}
      onPointerDown={(e) => {
        pointerXInteracting.current =
          e.clientX - pointerXInteractionMovement.current;
        pointerYInteracting.current =
          e.clientY - pointerYInteractionMovement.current;
        canvasRef.current && (canvasRef.current.style.cursor = "grabbing");
      }}
      onPointerUp={() => {
        pointerXInteracting.current = null;
        pointerYInteracting.current = null;
        canvasRef.current && (canvasRef.current.style.cursor = "grab");
      }}
      onPointerOut={() => {
        pointerXInteracting.current = null;
        pointerYInteracting.current = null;
        canvasRef.current && (canvasRef.current.style.cursor = "grab");
      }}
      onMouseMove={(e) => {
        if (
          pointerXInteracting.current !== null &&
          pointerYInteracting.current !== null
        ) {
          const deltaX = e.clientX - pointerXInteracting.current;
          const deltaY = e.clientY - pointerYInteracting.current;
          pointerXInteractionMovement.current = deltaX;
          pointerYInteractionMovement.current = deltaY;
          springX.set(deltaX / 100);
          enableYInteraction && springY.set(deltaY / 100);
        }
      }}
      onTouchMove={(e) => {
        if (
          pointerXInteracting.current !== null &&
          pointerYInteracting.current !== null &&
          e.touches[0]
        ) {
          const deltaX = e.touches[0].clientX - pointerXInteracting.current;
          const deltaY = e.touches[0].clientY - pointerYInteracting.current;
          pointerXInteractionMovement.current = deltaX;
          pointerYInteractionMovement.current = deltaY;
          springX.set(deltaX / 100);
          enableYInteraction && springY.set(deltaY / 100);
        }
      }}
      className={cn(className)}
      {...props}
      style={{
        contain: "layout paint size",
        cursor: "auto",
        userSelect: "none",
      }}
    />
  );
};

export default Location;
