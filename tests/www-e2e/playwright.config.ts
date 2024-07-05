import { PlaywrightTestConfig, devices, defineConfig } from "@playwright/test";
import path from "path";

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;

export default defineConfig({
  timeout: 30 * 1000,
  testDir: path.join(__dirname, "tests"),
  testMatch: "**/*.pw.ts",
  retries: 2,
  outputDir: "coverage",
  reporter: "html",

  webServer: {
    command: "cd ../.. && pnpm dev:www",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
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
    // playwright issue #11130 (https://github.com/microsoft/playwright/issues/11130)
    // {
    //   name: "desktop-firefox",
    //   use: {
    //     ...devices["Desktop Firefox"],
    //   },
    // },
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
