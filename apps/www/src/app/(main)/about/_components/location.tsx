"use client";

import createGlobe from "cobe";
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
} & Omit<ComponentPropsWithoutRef<"canvas">, "width" | "height">;

const Location: FC<LocationProps> = ({ className, location, ...props }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const { width, height } = useResizeObserver({
    ref: canvasRef,
    box: "border-box",
  });
  const x = useMotionValue(0);
  const spring = useSpring(x);
  const { isDarkMode } = useDarkMode();
  useEffect(() => {
    if (canvasRef.current && width && height) {
      const globe = createGlobe(canvasRef.current, {
        devicePixelRatio: 2,
        width: width * 2,
        height: width * 2,
        phi: 0,
        theta: -0.1,
        dark: isDarkMode ? 1 : 0,
        diffuse: 2,
        mapSamples: 36_000,
        mapBrightness: 2,
        baseColor: [0.8, 0.8, 0.8],
        markerColor: [235 / 255, 35 / 255, 35 / 255],
        glowColor: [0.5, 0.5, 0.5],
        markers: [{ location, size: 0.1 }],
        scale: 1.05,
        onRender: (state) => {
          state.phi = 2.75 + spring.get();
          state.theta = 0.1;
          state.width = width * 2;
          state.height = width * 2;
        },
      });

      return () => {
        globe.destroy();
      };
    }
  }, [width, height, x, isDarkMode]);
  return (
    <canvas
      ref={canvasRef}
      onPointerDown={(e) => {
        pointerInteracting.current =
          e.clientX - pointerInteractionMovement.current;
        canvasRef.current && (canvasRef.current.style.cursor = "grabbing");
      }}
      onPointerUp={() => {
        pointerInteracting.current = null;
        canvasRef.current && (canvasRef.current.style.cursor = "grab");
      }}
      onPointerOut={() => {
        pointerInteracting.current = null;
        canvasRef.current && (canvasRef.current.style.cursor = "grab");
      }}
      onMouseMove={(e) => {
        if (pointerInteracting.current !== null) {
          const delta = e.clientX - pointerInteracting.current;
          pointerInteractionMovement.current = delta;
          spring.set(delta / 100);
        }
      }}
      onTouchMove={(e) => {
        if (pointerInteracting.current !== null && e.touches[0]) {
          const delta = e.touches[0].clientX - pointerInteracting.current;
          pointerInteractionMovement.current = delta;
          spring.set(delta / 100);
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
