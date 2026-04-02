"use client";

import type {
  ComponentPropsWithoutRef,
  FC,
  ReactNode,
  PointerEvent,
  TouchEvent,
  RefObject,
} from "react";
import { useRef, useEffect, useCallback, useState } from "react";

import type { COBEOptions } from "cobe";
import createGlobe from "cobe";
import { useSpring, useMotionValue } from "motion/react";
import { useResizeObserver } from "usehooks-ts";

import Image from "@chia/ui/image";
import { cn } from "@chia/ui/utils/cn.util";
import useTheme from "@chia/ui/utils/use-theme";

type LocationProps = {
  location: [number, number];
  width: number | string;
  height: number | string;
  defaultPositionOffset?: [number, number];
  enableYInteraction?: boolean;
  cobeOptions?: Omit<Partial<COBEOptions>, "width" | "height">;
  stiffness?: number;
  damping?: number;
  fallbackElement?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"canvas">, "width" | "height">;

type Globe = ReturnType<typeof createGlobe>;

const Location: FC<LocationProps> = ({
  className,
  location,
  defaultPositionOffset = [0, 2.75],
  enableYInteraction,
  cobeOptions = {},
  stiffness = 50,
  damping = 30,
  fallbackElement,
  ...props
}) => {
  const [isError, setIsError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const globe = useRef<Globe>(null);
  const pointerXInteracting = useRef<number | null>(null);
  const pointerYInteracting = useRef<number | null>(null);
  const pointerXInteractionMovement = useRef(0);
  const pointerYInteractionMovement = useRef(0);
  const { width, height } = useResizeObserver({
    ref: canvasRef as RefObject<HTMLCanvasElement>,
    box: "border-box",
  });
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, {
    stiffness,
    damping,
  });
  const springY = useSpring(y, {
    stiffness,
    damping,
  });
  const { isDarkMode } = useTheme();
  const handleCobeUpdate = useCallback(() => {
    if (globe.current) {
      globe.current.update({
        phi: defaultPositionOffset[1] + springX.get(),
        theta: enableYInteraction
          ? defaultPositionOffset[0] + springY.get()
          : defaultPositionOffset[0],
      });
    }
  }, [springX, springY, defaultPositionOffset, enableYInteraction]);

  useEffect(() => {
    const unsubX = springX.on("change", handleCobeUpdate);
    const unsubY = springY.on("change", handleCobeUpdate);
    return () => {
      unsubX();
      unsubY();
    };
  }, [springX, springY, handleCobeUpdate]);

  useEffect(() => {
    let raf1: number, raf2: number;

    if (canvasRef.current && width && height) {
      try {
        const context = canvasRef.current.getContext("webgl");
        if (!context?.getContextAttributes()) {
          throw new Error("WebGL not supported, or context not available");
        }
        setIsError(false);
      } catch (e) {
        setIsError(true);
        console.error(e);
        return;
      }

      globe.current = createGlobe(canvasRef.current, {
        devicePixelRatio: 2,
        phi: defaultPositionOffset[1],
        theta: defaultPositionOffset[0],
        diffuse: 2,
        mapSamples: 36_000,
        mapBrightness: 2,
        baseColor: [0.8, 0.8, 0.8],
        markerColor: [235 / 255, 35 / 255, 35 / 255],
        glowColor: [0.5, 0.5, 0.5],
        scale: 1.05,
        dark: isDarkMode ? 1 : 0,
        context: { antialias: false },
        ...cobeOptions,
        markers: [{ size: 0.025, ...cobeOptions.markers, location }],
        width: width * 2,
        height: height * 2,
      });

      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          globe.current?.update({
            phi: defaultPositionOffset[1] + springX.get(),
            theta: enableYInteraction
              ? defaultPositionOffset[0] + springY.get()
              : defaultPositionOffset[0],
          });
        });
      });
    }

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      globe.current?.destroy();
    };
  }, [
    width,
    height,
    isDarkMode,
    location,
    defaultPositionOffset,
    cobeOptions,
    springX,
    springY,
    enableYInteraction,
  ]);

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      pointerXInteracting.current =
        e.clientX - pointerXInteractionMovement.current;
      pointerYInteracting.current =
        e.clientY - pointerYInteractionMovement.current;
      if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
    },
    [pointerXInteractionMovement, pointerYInteractionMovement]
  );

  const handlePointerUp = useCallback(() => {
    pointerXInteracting.current = null;
    pointerYInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  }, []);

  const handlePointOut = useCallback(() => {
    pointerXInteracting.current = null;
    pointerYInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  }, []);

  const handleMouseMove = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      if (
        pointerXInteracting.current !== null &&
        pointerYInteracting.current !== null
      ) {
        const deltaX = e.clientX - pointerXInteracting.current;
        const deltaY = e.clientY - pointerYInteracting.current;
        pointerXInteractionMovement.current = deltaX;
        pointerYInteractionMovement.current = deltaY;
        springX.set(deltaX / 100);
        if (enableYInteraction) springY.set(deltaY / 100);
      }
    },
    [enableYInteraction, springX, springY]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent<HTMLCanvasElement>) => {
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
        if (enableYInteraction) springY.set(deltaY / 100);
      }
    },
    [enableYInteraction, springX, springY]
  );

  return (
    <>
      {isError ? (
        <>
          {fallbackElement ?? (
            <div
              className={cn(
                "not-prose relative aspect-square w-[600px]",
                className
              )}>
              <Image
                src={
                  isDarkMode ? "/assets/globe.png" : "/assets/globe-light.png"
                }
                alt="globe-fallback"
                fill
                className="object-cover"
              />
            </div>
          )}
        </>
      ) : (
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerOut={handlePointOut}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          className={cn("h-full w-full contain-[layout_paint_size]", className)}
          {...props}
          style={{
            cursor: "auto",
            userSelect: "none",
            ...props.style,
          }}
        />
      )}
    </>
  );
};

export default Location;
