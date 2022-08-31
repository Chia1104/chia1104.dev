/** @type {import('next-sitemap').IConfig} */

module.exports = {
  siteUrl: process.env.SITE_URL || "https://www.chia1104.dev",
  generateRobotsTxt: true,
  changefreq: "always",
};
