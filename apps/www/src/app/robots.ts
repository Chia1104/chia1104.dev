import type { MetadataRoute } from "next";

import { WWW_BASE_URL } from "@chia/utils/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: [`${WWW_BASE_URL}/sitemap.xml`],
    host: WWW_BASE_URL,
  };
}
