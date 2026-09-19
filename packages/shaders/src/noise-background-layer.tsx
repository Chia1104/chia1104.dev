"use client";

import {
  Circle,
  FilmGrain,
  FlowField,
  Shader,
  SolidColor,
} from "shaders/react";

export interface NoiseBackgroundLayerProps {
  baseColor: string;
  colors: readonly [string, string];
  glowRadius: number;
  layerOpacity: { first: number; second: number };
  grain: number;
  flowSpeed: number;
  onReady: () => void;
  onUnavailable: () => void;
}

const NoiseBackgroundLayer = ({
  baseColor,
  colors,
  glowRadius,
  layerOpacity,
  grain,
  flowSpeed,
  onReady,
  onUnavailable,
}: NoiseBackgroundLayerProps) => (
  <Shader
    aria-hidden
    className="pointer-events-none absolute inset-0 size-full"
    onReady={onReady}
    onUnavailable={onUnavailable}>
    {/* The base sits inside the flow so its render target stays opaque; soft edges over a
        transparent target lose their color when the flow resamples them. */}
    <FlowField
      strength={0.25}
      detail={0.5}
      speed={flowSpeed}
      evolutionSpeed={flowSpeed}>
      <SolidColor color={baseColor} />
      <Circle
        center={{ x: 0.35, y: 0.4 }}
        radius={glowRadius}
        softness={1}
        color={colors[0]}
        opacity={layerOpacity.first}
      />
      <Circle
        center={{ x: 0.7, y: 0.65 }}
        radius={glowRadius}
        softness={1}
        color={colors[1]}
        opacity={layerOpacity.second}
      />
    </FlowField>
    <FilmGrain strength={grain} bias={0} />
  </Shader>
);

export default NoiseBackgroundLayer;
