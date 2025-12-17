import type { MetadataRoute } from "next";

import { DASH_BASE_URL } from "@chia/utils/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
    host: DASH_BASE_URL,
  };
}
