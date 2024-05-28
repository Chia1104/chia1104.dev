import type { MetadataRoute } from "next";
import { getBaseUrl, WWW_BASE_URL } from "@chia/utils";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: `${getBaseUrl({
      isServer: true,
      baseUrl: WWW_BASE_URL,
    })}/sitemap.xml`,
  };
}
