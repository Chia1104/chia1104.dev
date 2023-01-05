import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const config = {
  runtime: "experimental-edge",
};

export default function handler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const hasTitle = searchParams.has("title");
    const title = hasTitle
      ? searchParams.get("title")?.slice(0, 100)
      : "Full Stack Engineer";
    return new ImageResponse(
      (
        <div
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
              style={{
                filter: "grayscale(45%) blur(2px)",
              }}
              tw="w-full"
              alt="og"
              src="https://firebasestorage.googleapis.com/v0/b/chia1104.appspot.com/o/images%2Fog-img.png?alt=media"
            />
            <div tw="flex absolute w-full justify-center items-center p-20">
              <div tw="flex flex-col justify-center items-center mr-10">
                <img
                  style={{
                    objectFit: "contain",
                  }}
                  tw="w-[200px] h-[200px] rounded-full"
                  alt="avatar"
                  src="https://firebasestorage.googleapis.com/v0/b/chia1104.appspot.com/o/images%2Fme%2Fme.JPG?alt=media"
                />
                <h1 tw="text-3xl text-slate-900">Chia1104 - 俞又嘉</h1>
                <h2 tw="text-xl text-slate-700">https://chia1104.dev</h2>
              </div>
              <h3 tw="text-[55px] text-slate-600 ml-10">{title}</h3>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
