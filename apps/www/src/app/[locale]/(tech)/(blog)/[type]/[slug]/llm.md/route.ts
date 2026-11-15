import { notFound, permanentRedirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { safe } from "@orpc/client";

import { WWW_BASE_URL } from "@chia/utils/config";
import { isEnumValue } from "@chia/utils/is";

import { getPathname } from "@/libs/i18n/navigation";
import { client } from "@/libs/orpc/client.rsc";
import { isServiceNotFound } from "@/libs/orpc/report";
import { Locale, dbLocaleResolver } from "@/libs/utils/i18n";

export const GET = async (
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ locale: string; type: string; slug: string }> }
) => {
  const { locale, type, slug } = await params;
  if (!isEnumValue(Locale, locale)) notFound();
  const { error, data: feed } = await safe(
    client.feeds["details-by-slug"]({
      slug,
      locale: dbLocaleResolver(locale),
    })
  );
  if (isServiceNotFound(error)) notFound();
  if (error) throw error;
  const href = `/${feed.type}s/${slug}`;
  if (`${feed.type}s` !== type) {
    permanentRedirect(getPathname({ href: `${href}/llm.md`, locale }));
  }
  return new Response(feed.translations[0]?.content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      /** Search engines credit the HTML article, not this copy of it. */
      Link: `<${WWW_BASE_URL}${getPathname({ href, locale })}>; rel="canonical"`,
    },
  });
};
