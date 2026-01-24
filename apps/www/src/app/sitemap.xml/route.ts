import { NextResponse } from "next/server";

import { captureException } from "@sentry/nextjs";

import { getBaseUrl, WWW_BASE_URL } from "@chia/utils/config";
import { errorGenerator } from "@chia/utils/server";

import { client } from "@/libs/service/client.rsc";
import { HonoRPCError } from "@/libs/service/error";

import { URLS_PER_SITEMAP } from "./utils";

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
  let total = 0;
  try {
    const res = await client.api.v1.admin.public["feeds:meta"].$get();
    if (!res.ok) {
      total = 0;
      captureException(
        new HonoRPCError(res.statusText, res.status, res.statusText)
      );
    } else {
      total = (await res.json()).total;
    }

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
