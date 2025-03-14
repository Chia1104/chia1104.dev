import { ImageResponse } from "next/og";

import meta from "@chia/meta";
import OpenGraph from "@chia/ui/open-graph";

export const alt = "Chia1104";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const runtime = "edge";

export default function og() {
  return new ImageResponse(
    (
      <OpenGraph
        metadata={{
          title: `${meta.name}.dev`,
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
