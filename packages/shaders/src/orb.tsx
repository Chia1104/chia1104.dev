"use client";

import { MeshGradient, Saturation, Shader, Spherize } from "shaders/react";

import { cn } from "@chia/ui/utils/cn.util";

export type OrbState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "asleep";

const STATES = {
  idle: { speed: 0.5, drift: 0.7, swirl: 0.5, saturation: 1.5, pulse: false },
  listening: {
    speed: 1.1,
    drift: 0.9,
    swirl: 0.6,
    saturation: 1.6,
    pulse: false,
  },
  thinking: { speed: 1.8, drift: 1, swirl: 0.9, saturation: 1.5, pulse: false },
  speaking: { speed: 2.4, drift: 1, swirl: 0.7, saturation: 1.7, pulse: true },
  asleep: {
    speed: 0.12,
    drift: 0.4,
    swirl: 0.3,
    saturation: 0.75,
    pulse: false,
  },
} satisfies Record<
  OrbState,
  {
    speed: number;
    drift: number;
    swirl: number;
    saturation: number;
    pulse: boolean;
  }
>;

interface Props {
  className?: string;
  state?: OrbState;
  meshGradientProps?: React.ComponentProps<typeof MeshGradient>;
  saturationProps?: React.ComponentProps<typeof Saturation>;
  spherizeProps?: React.ComponentProps<typeof Spherize>;
}

export const Orb = (props: Props) => {
  const state = STATES[props.state ?? "idle"];
  return (
    <Shader className={cn("size-25", props.className)}>
      <MeshGradient
        stops={[
          { color: "#fff6e8", position: 0 },
          { color: "#ffd900", position: 0.18 },
          { color: "#f01000", position: 0.36 },
          { color: "#e422d6", position: 0.52 },
          { color: "#1420c8", position: 0.68 },
          { color: "#00c2f0", position: 0.85 },
          { color: "#fff6e8", position: 1 },
        ]}
        colorSpace="oklab"
        count={8}
        smoothness={2.6}
        variation={0.4}
        swirl={state.swirl}
        drift={state.drift}
        speed={state.speed}
        seed={88}
        {...props.meshGradientProps}
      />
      <Saturation intensity={state.saturation} {...props.saturationProps} />
      <Spherize
        radius={
          state.pulse
            ? {
                type: "auto-animate",
                mode: "ping-pong",
                outputMin: 0.85,
                outputMax: 0.93,
                speed: 1.4,
                easing: "sine",
              }
            : 0.9
        }
        depth={1.7}
        lightIntensity={0.25}
        lightSoftness={0.8}
        lightColor="#ffffff"
        {...props.spherizeProps}
      />
    </Shader>
  );
};
