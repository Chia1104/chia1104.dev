import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

import { Locale as DBLocale } from "@chia/db/types";
import OpenGraph from "@chia/ui/open-graph";
import dayjs from "@chia/utils/day";
import { errorGenerator } from "@chia/utils/server";

import { Locale } from "@/libs/utils/i18n";
import { getFeedBySlug } from "@/services/feeds.service";

export const alt = "Blog";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function og({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const post = await getFeedBySlug(slug, localeResolver(locale));
  const translation = post?.translations[0];
  if (!translation) {
    return NextResponse.json(errorGenerator(404), { status: 404 });
  }
  return new ImageResponse(
    <OpenGraph
      metadata={{
        title: translation.title,
        excerpt: translation.excerpt,
        subtitle: dayjs(post.updatedAt).format("MMMM D, YYYY"),
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
    }
  );
}

function localeResolver(locale: string) {
  switch (locale) {
    case Locale.EN:
      return DBLocale.En;
    case Locale.ZH_TW:
      return DBLocale.zhTW;
    default:
      return DBLocale.zhTW;
  }
}
