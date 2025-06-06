import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";

import meta, { getWorkDuration } from "@chia/meta";
import OpenGraph from "@chia/ui/open-graph";

export const alt = "About Me";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const runtime = "edge";

const TITLE = "About Me";

export default async function og() {
  const t = await getTranslations("home");
  const workDuration = getWorkDuration(meta.timeline);
  return new ImageResponse(
    (
      <OpenGraph
        metadata={{
          title: TITLE,
          excerpt: t("section1", { year: workDuration.toString() }),
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
