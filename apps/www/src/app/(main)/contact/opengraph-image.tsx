import { ImageResponse } from "next/og";
import { OpenGraph } from "@chia/ui";
import { Chia } from "@/shared/meta/chia";

export const alt = "Contact Me";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const runtime = "edge";

const TITLE = "Contact Me";

export default async function og() {
  return new ImageResponse(
    (
      <OpenGraph
        metadata={{
          title: TITLE,
          excerpt:
            "If you want to get in touch with me, you can send me an email first and we can go from there. I'm always open to new opportunities and support requests.",
          subtitle: Chia.bio,
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
