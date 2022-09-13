function getBaseUrl() {
  if (process.env.RAILWAY_STATIC_URL) {
    return `https://${process.env.RAILWAY_STATIC_URL}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return process.env.NODE_ENV !== "production"
    ? "http://localhost:3000"
    : "https://www.chia1104.dev";
}

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  openGraph: {
    type: "website",
    locale: "zh_IE",
    url: getBaseUrl(),
    site_name: "chia1104",
  },
  twitter: {
    handle: "@handle",
    site: "@site",
    cardType: "summary_large_image",
  },
};
