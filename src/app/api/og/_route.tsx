import { ImageResponse } from "@vercel/og";
import { NextRequest, NextResponse } from "next/server";

export const config = {
  runtime: "edge",
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
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
              src="/og-img.png"
            />
            <div tw="flex absolute w-full justify-center items-center p-20">
              <div tw="flex flex-col justify-center items-center mr-10">
                <img
                  style={{
                    objectFit: "contain",
                  }}
                  tw="w-[200px] h-[200px] rounded-full"
                  alt="avatar"
                  src="/me/me-175.jpg"
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
