import { captureException } from "@sentry/nextjs";
import type { MetadataRoute } from "next";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getFeedsWithMetaByAdminId } from "@chia/api/services/feeds";
import {
  getBaseUrl,
  WWW_BASE_URL,
  errorGenerator,
  numericStringSchema,
} from "@chia/utils";
import dayjs from "@chia/utils/day";

import { env } from "@/env";
import routes from "@/shared/routes";

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
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const storedParams = await params;
    numericStringSchema.parse(storedParams.id);

    const feeds = await getFeedsWithMetaByAdminId(
      {
        cfBypassToken: env.CF_BYPASS_TOKEN,
        apiKey: env.CH_API_KEY ?? "",
      },
      {
        limit: 1000,
        type: "all",
        orderBy: "updatedAt",
        sortOrder: "desc",
        withContent: "false",
        published: "true",
      }
    );

    const staticSitemapData = Object.entries(routes).map(
      ([path, { priority }]) =>
        ({
          url: `${getBaseUrl({
            isServer: true,
            baseUrl: WWW_BASE_URL,
            useBaseUrl: true,
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
            useBaseUrl: true,
          })}/${feed.type}/${feed.slug}`,
          lastModified: dayjs(feed.updatedAt).toISOString(),
          priority: 0.8,
        }) satisfies MetadataRoute.Sitemap[0]
    );
    const xml = buildPagesSitemap([
      {
        url: getBaseUrl({
          isServer: true,
          baseUrl: WWW_BASE_URL,
          useBaseUrl: true,
        }),
        lastModified: new Date().toISOString(),
        priority: 0.7,
      },
      {
        url: `${getBaseUrl({
          isServer: true,
          baseUrl: WWW_BASE_URL,
          useBaseUrl: true,
        })}/notes`,
        lastModified: new Date().toISOString(),
        priority: 0.8,
      },
      ...staticSitemapData,
      ...feedsSitemapData,
    ]);
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
      },
    });
  } catch (error) {
    console.error(error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorGenerator(
          400,
          error.issues?.map((issue) => {
            return {
              field: "sitemap index",
              message: issue.message,
            };
          })
        ),
        {
          status: 400,
        }
      );
    }

    captureException(error);
    return NextResponse.json(errorGenerator(500), {
      status: 500,
    });
  }
};
