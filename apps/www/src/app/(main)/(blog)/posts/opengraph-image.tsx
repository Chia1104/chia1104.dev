import { ImageResponse } from "next/og";
import { OpenGraph } from "@chia/ui";
import meta from "@chia/meta";

export const alt = "Blog";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const runtime = "edge";

const TITLE = "Blog";

export default async function og() {
  return new ImageResponse(
    (
      <OpenGraph
        metadata={{
          title: TITLE,
          excerpt: meta.content,
          subtitle: meta.bio,
        }}
        styles={{
          title: {
            color: "transparent",
          },
        }}
      />
    ),
    {
      ...size,
      status: 200,
    }
  );
}
