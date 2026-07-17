import { NextResponse } from "next/server";

import { googleFonts } from "takumi-js/helpers";
import { ImageResponse } from "takumi-js/response";

import OpenGraph from "@chia/ui/open-graph";
import dayjs from "@chia/utils/day";
import { errorGenerator } from "@chia/utils/server";

import { dbLocaleResolver } from "@/libs/utils/i18n";
import { getFeedBySlug } from "@/services/feeds.service";

const imageSize = {
  width: 1200,
  height: 630,
};

interface CreateFeedOpenGraphImageOptions {
  locale: string;
  slug: string;
  theme?: "light" | "dark";
}

export async function createFeedOpenGraphImage({
  locale,
  slug,
  theme = "light",
}: CreateFeedOpenGraphImageOptions) {
  const post = await getFeedBySlug(slug, dbLocaleResolver(locale));
  const translation = post?.translations[0];

  if (!translation) {
    return NextResponse.json(errorGenerator(404), { status: 404 });
  }

  return new ImageResponse(
    <OpenGraph
      theme={theme}
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
      ...imageSize,
      status: 200,
      fonts: googleFonts(["Inter", "Noto Sans JP", "Noto Sans TC"]),
    }
  );
}
