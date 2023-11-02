"use server";

import React, { type FC } from "react";

interface Props {
  src?: string;
  metadata?: {
    title?: string;
    name?: string;
    url?: string;
  };
}

const DEFAULT_SRC =
  "https://firebasestorage.googleapis.com/v0/b/chia1104.appspot.com/o/images%2Ffotor-ai-20231102111155.jpg?alt=media";

const OG: FC<Props> = ({ src = DEFAULT_SRC, metadata }) => {
  return (
    <div
      // @ts-ignore
      tw="bg-slate-900"
      style={{
        backgroundSize: "150px 150px",
        height: "100%",
        width: "100%",
        display: "flex",
        textAlign: "center",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        flexWrap: "nowrap",
      }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          justifyItems: "center",
          position: "relative",
        }}>
        <img
          // @ts-ignore
          tw="w-full"
          alt="og"
          src={src}
        />
        <div
          // @ts-ignore
          tw="flex flex-col absolute w-full justify-center items-center">
          <div
            style={{
              backdropFilter: "blur(10px)",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              color: "#fff",
              fontSize: 60,
              fontStyle: "normal",
              letterSpacing: "-0.025em",
              padding: "30px 10px 20px 20px",
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
            }}>
            {metadata?.title ?? "Chia1104"}
          </div>
        </div>
        <div
          // @ts-ignore
          tw="flex flex-col justify-center items-center mr-10 absolute bottom-10">
          <div
            // @ts-ignore
            tw="text-3xl text-white">
            {metadata?.name ?? "Chia1104"}
          </div>
          <div
            // @ts-ignore
            tw="text-xl text-white">
            {metadata?.url ?? "https://chia1104.dev"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OG;
