import { NextResponse } from "next/server";

import { safe } from "@orpc/client";
import { googleFonts } from "takumi-js/helpers";
import { ImageResponse } from "takumi-js/response";

import OpenGraph from "@chia/ui/open-graph";
import dayjs from "@chia/utils/day";
import { errorGenerator } from "@chia/utils/server";

import { client } from "@/libs/orpc/client.rsc";
import { reportServiceError } from "@/libs/orpc/report";
import { dbLocaleResolver } from "@/libs/utils/i18n";

const imageSize = {
  width: 1200,
  height: 630,
};

interface CreateFeedOpenGraphImageOptions {
  locale: string;
  slug: string;
}

export async function createFeedOpenGraphImage({
  locale,
  slug,
}: CreateFeedOpenGraphImageOptions) {
  const { error, data: post } = await safe(
    client.feeds["details-by-slug"]({
      slug,
      locale: dbLocaleResolver(locale),
    })
  );
  if (error) {
    reportServiceError(error);
    return NextResponse.json(errorGenerator(404), { status: 404 });
  }

  const translation = post.translations[0];

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
      ...imageSize,
      status: 200,
      fonts: googleFonts(["Inter", "Noto Sans JP", "Noto Sans TC"]),
    }
  );
}
