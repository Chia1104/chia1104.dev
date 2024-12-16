import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

import OpenGraph from "@chia/ui/open-graph";
import { errorGenerator } from "@chia/utils";
import dayjs from "@chia/utils/day";

import { getNoteBySlug } from "@/services/feeds.service";

export const alt = "Blog";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function og({ params }: { params: { slug: string } }) {
  const note = await getNoteBySlug(params.slug);
  if (!note) {
    return NextResponse.json(errorGenerator(404), { status: 404 });
  }
  return new ImageResponse(
    (
      <OpenGraph
        metadata={{
          title: note.title,
          excerpt: note.excerpt,
          subtitle: dayjs(note.updatedAt).format("MMMM D, YYYY"),
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
