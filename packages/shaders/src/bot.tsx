"use client";

import { Spherize, SolidColor, Blob, ChromaFlow, Shader } from "shaders/react";

import { cn } from "@chia/ui/utils/cn.util";

interface Props {
  className?: string;
  spherizeProps?: React.ComponentProps<typeof Spherize>;
  solidColorProps?: React.ComponentProps<typeof SolidColor>;
  blobsProps?: {
    alpha: React.ComponentProps<typeof Blob>;
    beta: React.ComponentProps<typeof Blob>;
    gamma: React.ComponentProps<typeof Blob>;
  };
  chromaFlowProps?: React.ComponentProps<typeof ChromaFlow>;
}

export const Bot = (props: Props) => {
  return (
    <Shader className={cn("size-25", props.className)}>
      <Spherize
        radius={1}
        depth={1.79}
        lightIntensity={0.5}
        lightSoftness={0.5}
        lightColor="#ffffff">
        <SolidColor color="#08071a" {...props.solidColorProps} />
        <Blob
          colorA="#2B2E4A"
          colorB="#ff6e00"
          center={{
            x: 0.05,
            y: 0.25,
          }}
          {...props.blobsProps?.alpha}
        />
        <Blob
          colorA="#e6e601"
          colorB="#07bccc"
          center={{
            x: 0.95,
            y: 0.25,
          }}
          {...props.blobsProps?.beta}
        />
        <Blob
          colorA="#041d8c"
          colorB="#e601c0"
          center={{
            x: 0.5,
            y: 1,
          }}
          {...props.blobsProps?.gamma}
        />
        <ChromaFlow
          baseColor="#2B2E4A"
          upColor="#07bccc"
          downColor="#ff6e00"
          leftColor="#e601c0"
          rightColor="#e6e601"
          {...props.chromaFlowProps}
        />
      </Spherize>
    </Shader>
  );
};
