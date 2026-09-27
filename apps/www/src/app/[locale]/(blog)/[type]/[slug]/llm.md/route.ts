import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";

import { safe } from "@orpc/client";

import { client } from "@/libs/orpc/client.rsc";
import { isServiceNotFound } from "@/libs/orpc/report";
import { dbLocaleResolver } from "@/libs/utils/i18n";

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; slug: string }> }
) => {
  const { locale, slug } = await params;
  const { error, data: feed } = await safe(
    client.feeds["details-by-slug"]({
      slug,
      locale: dbLocaleResolver(locale),
    })
  );
  if (isServiceNotFound(error)) notFound();
  if (error) throw error;
  return new Response(feed.translations[0]?.content, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
