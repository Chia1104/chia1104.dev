/** @type {import('next-sitemap').IConfig} */

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

module.exports = {
  siteUrl: getBaseUrl(),
  generateRobotsTxt: true,
  changefreq: "always",
};
