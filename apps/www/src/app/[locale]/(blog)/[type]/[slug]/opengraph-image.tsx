import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

import OpenGraph from "@chia/ui/open-graph";
import { errorGenerator } from "@chia/utils";
import dayjs from "@chia/utils/day";

import { getFeedBySlug } from "@/services/feeds.service";

export const alt = "Blog";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function og({ params }: { params: { slug: string } }) {
  const post = await getFeedBySlug(params.slug);
  if (!post) {
    return NextResponse.json(errorGenerator(404), { status: 404 });
  }
  return new ImageResponse(
    (
      <OpenGraph
        metadata={{
          title: post.title,
          excerpt: post.excerpt,
          subtitle: dayjs(post.updatedAt).format("MMMM D, YYYY"),
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
