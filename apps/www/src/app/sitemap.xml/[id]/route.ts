import * as sentry from "@sentry/nextjs";
import dayjs from "dayjs";
import type { MetadataRoute } from "next";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDB, getInfiniteFeedsByUserId } from "@chia/db";
import {
  getBaseUrl,
  WWW_BASE_URL,
  getAdminId,
  errorGenerator,
  numericStringSchema,
} from "@chia/utils";

import routes from "@/shared/routes";

export const dynamic = "force-dynamic";

function buildPagesSitemap(sitemapData: MetadataRoute.Sitemap) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

  for (const data of sitemapData) {
    xml += "<url>";
    xml += `<loc>${data.url}</loc>`;
    xml += `<lastmod>${dayjs(data.lastModified).toISOString()}</lastmod>`;
    xml += `<changefreq>daily</changefreq>`;
    xml += `<priority>${data.priority}</priority>`;
    xml += "</url>";
  }

  xml += "</urlset>";
  return xml;
}

export const GET = async (
  request: NextRequest,
  // sitemap index
  { params }: { params: { id: string } }
) => {
  try {
    numericStringSchema.parse(params.id);

    // handle sitemap index
    const feeds = await getInfiniteFeedsByUserId(getDB(), {
      limit: 1000,
      orderBy: "updatedAt",
      sortOrder: "desc",
      type: "all",
      withContent: false,
      userId: getAdminId(),
    });

    const staticSitemapData = Object.entries(routes).map(
      ([path, { priority }]) =>
        ({
          url: `${getBaseUrl({
            isServer: true,
            baseUrl: WWW_BASE_URL,
          })}${path}`,
          lastModified: new Date().toISOString(),
          priority: priority,
        }) satisfies MetadataRoute.Sitemap[0]
    );

    const feedsSitemapData = feeds.items.map(
      (feed) =>
        ({
          url: `${getBaseUrl({
            isServer: true,
            baseUrl: WWW_BASE_URL,
          })}/${feed.type}s/${feed.slug}`,
          lastModified: feed.updatedAt.toISOString(),
          priority: 0.8,
        }) satisfies MetadataRoute.Sitemap[0]
    );
    const xml = buildPagesSitemap([...staticSitemapData, ...feedsSitemapData]);
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
      },
    });
  } catch (error) {
    console.error(error);

    if (error instanceof z.ZodError) {
      return { notFound: true };
    }

    sentry.captureException(error);
    return NextResponse.json(errorGenerator(500), {
      status: 500,
    });
  }
};
