function getBaseUrl() {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }

  if (process.env.ZEABUR_URL) {
    return `https://${process.env.ZEABUR_URL}`;
  }

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

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: getBaseUrl(),
  generateRobotsTxt: true,
  changefreq: "always",
};
