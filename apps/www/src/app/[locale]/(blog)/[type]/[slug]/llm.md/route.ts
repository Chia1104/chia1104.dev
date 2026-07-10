import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";

import { dbLocaleResolver } from "@/libs/utils/i18n";
import { getFeedBySlug } from "@/services/feeds.service";

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; slug: string }> }
) => {
  const { locale, slug } = await params;
  const feed = await getFeedBySlug(slug, dbLocaleResolver(locale));
  if (!feed || feed.contentType !== "mdx") {
    notFound();
  }
  return new Response(feed.translations[0]?.content?.content, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
