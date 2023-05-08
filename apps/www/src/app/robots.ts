import { type MetadataRoute } from "next";
import { getBaseUrl } from "@/utils/getBaseUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: `${getBaseUrl({ isServer: true })}/sitemap.xml`,
  };
}
