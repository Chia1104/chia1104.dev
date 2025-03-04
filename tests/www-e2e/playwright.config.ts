import { devices, defineConfig } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";
export const BASE_URL = `http://${HOST}:${PORT}`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  timeout: 30 * 1000,
  testDir: path.join(__dirname, "tests"),
  testMatch: "**/*.pw.ts",
  retries: 2,
  outputDir: "coverage",
  reporter: "html",

  webServer: {
    command: "pnpm run start:www",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    cwd: path.join(__dirname, "../.."),
    env: {
      DEBUG: "pw:webserver",
    },
  },

  use: {
    baseURL: BASE_URL,
    trace: "retry-with-trace",
    contextOptions: {
      ignoreHTTPSErrors: true,
    },
  },

  projects: [
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "desktop-firefox",
      use: {
        ...devices["Desktop Firefox"],
      },
    },
    {
      name: "desktop-safari",
      use: {
        ...devices["Desktop Safari"],
      },
    },
    // Test against mobile viewports.
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
      },
    },
    {
      name: "mobile-safari",
      use: devices["iPhone 12"],
    },
  ],
});
