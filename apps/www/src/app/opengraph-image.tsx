import { ImageResponse } from "next/server";

export const alt = "Chia1104";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const runtime = "edge";

const TITLE = "Full Stack Engineer";

const font = fetch(new URL("../assets/abduction2002.ttf", import.meta.url))
  .then((res) => res.arrayBuffer())
  .catch(() => undefined);

export default async function og() {
  const fontData = await font;
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
            tw="w-full"
            alt="og"
            src="https://firebasestorage.googleapis.com/v0/b/chia1104.appspot.com/o/images%2Fcyberpunk-1200-630.jpg?alt=media"
          />
          <div tw="flex flex-col absolute w-full justify-center items-center">
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
              {TITLE}
            </div>
          </div>
          <div tw="flex flex-col justify-center items-center mr-10 absolute bottom-10">
            <div tw="text-3xl text-white">Chia1104</div>
            <div tw="text-xl text-white">https://chia1104.dev</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      status: 200,
      fonts: fontData
        ? [
            {
              name: "Typewriter",
              data: fontData,
              style: "normal",
            },
          ]
        : undefined,
    }
  );
}
