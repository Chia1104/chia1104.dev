import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

import OpenGraph from "@chia/ui/open-graph";
import dayjs from "@chia/utils/day";
import { errorGenerator } from "@chia/utils/server";

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
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getFeedBySlug(slug);
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
