import { ImageResponse } from "next/og";

import meta from "@chia/meta";
import OpenGraph from "@chia/ui/open-graph";

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
