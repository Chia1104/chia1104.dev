import { captureException } from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { getMeta } from "@chia/api/services/feeds";
import { getBaseUrl, WWW_BASE_URL, errorGenerator } from "@chia/utils";

import { env } from "@/env";

import { URLS_PER_SITEMAP } from "./utils";

export const dynamic = "force-dynamic";

function buildSitemapIndex(sitemaps: string[]) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

  for (const sitemapURL of sitemaps) {
    xml += "<sitemap>";
    xml += `<loc>${sitemapURL}</loc>`;
    xml += "</sitemap>";
  }

  xml += "</sitemapindex>";
  return xml;
}

export const GET = async () => {
  try {
    const { total } = await getMeta(env.INTERNAL_REQUEST_SECRET, null);

    const amountOfSitemapFiles = Math.ceil(total / URLS_PER_SITEMAP);

    const sitemaps = Array(amountOfSitemapFiles)
      .fill("")
      .map(
        (v, index) =>
          `${getBaseUrl({
            isServer: true,
            baseUrl: WWW_BASE_URL,
            useBaseUrl: true,
          })}/sitemap-${index}.xml`
      );

    const sitemapIndexXML = buildSitemapIndex(sitemaps);

    return new NextResponse(sitemapIndexXML, {
      headers: {
        "Content-Type": "application/xml",
      },
    });
  } catch (error) {
    console.error(error);
    captureException(error);
    return NextResponse.json(errorGenerator(500), {
      status: 500,
    });
  }
};
