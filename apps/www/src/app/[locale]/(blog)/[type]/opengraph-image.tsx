import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";

import meta, { getWorkDuration } from "@chia/meta";
import OpenGraph from "@chia/ui/open-graph";

export const alt = "Blog";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const runtime = "edge";

export default async function og(
  props: PagePropsWithLocale<{ type: "posts" | "notes" }>
) {
  const { type } = await props.params;
  const [tFeed, t] = await Promise.all([
    getTranslations(`blog.${type}`),
    getTranslations("home"),
  ]);
  const workDuration = getWorkDuration(meta.timeline);
  return new ImageResponse(
    (
      <OpenGraph
        metadata={{
          title: tFeed("doc-title"),
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
