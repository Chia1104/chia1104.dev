import { NextResponse } from "next/server";

import { errorGenerator } from "@chia/utils/server";

import { verifyFeedImageToken } from "@/libs/utils/feed-image-token";
import { createFeedOpenGraphImage } from "@/services/feed-open-graph.service";

export const revalidate = 300;

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: PageParamsWithLocale<{ slug: string; type: string }>;
  }
) {
  const { locale, slug, type } = await params;
  const searchParams = new URL(request.url).searchParams;
  const token = searchParams.get("token");
  const theme = searchParams.get("theme");

  if (!token || !verifyFeedImageToken({ locale, slug, type }, token)) {
    return NextResponse.json(errorGenerator(401), { status: 401 });
  }

  return createFeedOpenGraphImage({
    locale,
    slug,
    theme: theme as "light" | "dark",
  });
}
