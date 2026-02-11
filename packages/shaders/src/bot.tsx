"use client";

import { Spherize, SolidColor, Blob, ChromaFlow, Shader } from "shaders/react";

export const Bot = () => {
  return (
    <Shader className="size-40">
      <Spherize
        radius={1}
        depth={1.79}
        lightIntensity={0.5}
        lightSoftness={0.5}
        lightColor="#ffffff">
        <SolidColor color="#08071a" />
        <Blob
          colorA="#2B2E4A"
          colorB="#ff6e00"
          center={{
            x: 0.05,
            y: 0.25,
          }}
        />
        <Blob
          colorA="#e6e601"
          colorB="#07bccc"
          center={{
            x: 0.95,
            y: 0.25,
          }}
        />
        <Blob
          colorA="#041d8c"
          colorB="#e601c0"
          center={{
            x: 0.5,
            y: 1,
          }}
        />
        <ChromaFlow
          baseColor="#2B2E4A"
          upColor="#07bccc"
          downColor="#ff6e00"
          leftColor="#e601c0"
          rightColor="#e6e601"
        />
      </Spherize>
    </Shader>
  );
};
