import { ImageResponse } from "next/server";

export const alt = "About Me";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const runtime = "edge";

const TITLE = "About Me";

export default function og() {
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
            src="https://firebasestorage.googleapis.com/v0/b/chia1104.appspot.com/o/images%2Fog-img-1200.png?alt=media"
          />
          <div tw="flex absolute w-full justify-center items-center p-20">
            <div tw="flex flex-col justify-center items-center mr-10">
              <img
                style={{
                  objectFit: "contain",
                }}
                tw="w-[200px] h-[200px] rounded-full"
                alt="avatar"
                src="https://firebasestorage.googleapis.com/v0/b/chia1104.appspot.com/o/images%2Fme-175.jpg?alt=media"
              />
              <h1 tw="text-3xl text-slate-900">Chia1104 - 俞又嘉</h1>
              <h2 tw="text-xl text-slate-700">https://chia1104.dev</h2>
            </div>
            <h3 tw="text-[55px] text-slate-600 ml-10">{TITLE}</h3>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      status: 200,
    }
  );
}
