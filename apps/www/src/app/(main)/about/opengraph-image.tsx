import { ImageResponse } from "next/og";
import { OpenGraph } from "@chia/ui";

export const alt = "About Me";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const runtime = "edge";

const TITLE = "About Me";

const font = fetch(
  new URL("../../../assets/abduction2002.ttf", import.meta.url)
)
  .then((res) => res.arrayBuffer())
  .catch(() => undefined);

export default async function og() {
  const fontData = await font;
  return new ImageResponse(
    (
      <OpenGraph
        metadata={{
          title: TITLE,
        }}
      />
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
