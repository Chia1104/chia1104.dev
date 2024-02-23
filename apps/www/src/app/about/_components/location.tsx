"use client";

import createGlobe, { type COBEOptions } from "cobe";
import {
  type ComponentPropsWithoutRef,
  type FC,
  type ReactNode,
  useRef,
  useEffect,
  useCallback,
  useState,
  type PointerEvent,
  type TouchEvent,
} from "react";
import { cn, useTheme, Image } from "@chia/ui";
import { useResizeObserver } from "usehooks-ts";
import { useSpring, useMotionValue } from "framer-motion";

type LocationProps = {
  location: [number, number];
  width: number | string;
  height: number | string;
  defaultPositionOffset?: [number, number];
  enableYInteraction?: boolean;
  cobeOptions?: Omit<Partial<COBEOptions>, "width" | "height" | "onRender">;
  stiffness?: number;
  damping?: number;
  fallbackElement?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"canvas">, "width" | "height">;

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
  const globe = useRef<ReturnType<typeof createGlobe>>();
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
  const springX = useSpring(x, {
    stiffness,
    damping,
  });
  const springY = useSpring(y, {
    stiffness,
    damping,
  });
  const { isDarkMode } = useTheme();
  useEffect(() => {
    if (canvasRef.current && width && height) {
      try {
        const context = canvasRef.current.getContext("webgl");
        if (!context || !context?.getContextAttributes()) {
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
        context: { antialias: false },
        ...cobeOptions,
        markers: [{ size: 0.1, ...cobeOptions.markers, location }],
        width: width * 2,
        height: height * 2,
        onRender: (state) => {
          state.phi = defaultPositionOffset[1] + springX.get();
          state.theta = enableYInteraction
            ? defaultPositionOffset[0] + springY.get()
            : defaultPositionOffset[0];
          state.width = width * 2;
          state.height = height * 2;
        },
      });
    }
    return () => {
      globe.current?.destroy();
    };
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

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      pointerXInteracting.current =
        e.clientX - pointerXInteractionMovement.current;
      pointerYInteracting.current =
        e.clientY - pointerYInteractionMovement.current;
      canvasRef.current && (canvasRef.current.style.cursor = "grabbing");
    },
    [pointerXInteractionMovement, pointerYInteractionMovement]
  );

  const handlePointerUp = useCallback(() => {
    pointerXInteracting.current = null;
    pointerYInteracting.current = null;
    canvasRef.current && (canvasRef.current.style.cursor = "grab");
  }, []);

  const handlePointOut = useCallback(() => {
    pointerXInteracting.current = null;
    pointerYInteracting.current = null;
    canvasRef.current && (canvasRef.current.style.cursor = "grab");
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
        enableYInteraction && springY.set(deltaY / 100);
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
        enableYInteraction && springY.set(deltaY / 100);
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
                "not-prose aspect-h-1 aspect-w-1 relative w-[600px]",
                className
              )}>
              <Image
                src={
                  isDarkMode ? "/assets/globe.png" : "/assets/globe-light.png"
                }
                alt="globe-fallback"
                blur={false}
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
          className={cn("h-full w-full [contain:layout_paint_size]", className)}
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
