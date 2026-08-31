import { getTranslations } from "next-intl/server";
import { googleFonts } from "takumi-js/helpers";
import { ImageResponse } from "takumi-js/response";

import meta, { getWorkDuration } from "@chia/meta";
import OpenGraph from "@chia/ui/open-graph";

export const alt = "Chia1104";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function og({ params }: { params: PageParamsWithLocale }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const workDuration = getWorkDuration(meta.timeline);
  return new ImageResponse(
    <OpenGraph
      metadata={{
        title: `${meta.name}.dev`,
        excerpt: t("section1", { year: workDuration.toString() }),
      }}
      styles={{
        title: {
          color: "transparent",
        },
      }}
    />,
    {
      ...size,
      status: 200,
      fonts: googleFonts(["Inter", "Noto Sans JP", "Noto Sans TC"]),
    }
  );
}
