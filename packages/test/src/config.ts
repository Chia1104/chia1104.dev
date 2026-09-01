import { defineConfig, mergeConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

const include = [
  "__tests__/**/*.{test,spec}.{ts,tsx,mts}",
  "src/**/*.{test,spec}.{ts,tsx,mts}",
];

const sharedTest = {
  globals: false,
  include,
  clearMocks: true,
} as const;

export const nodeConfig = (overrides: ViteUserConfig = {}) =>
  mergeConfig(
    defineConfig({
      test: {
        ...sharedTest,
        environment: "node",
      },
    }),
    defineConfig(overrides)
  );

export const domConfig = (overrides: ViteUserConfig = {}) =>
  mergeConfig(
    defineConfig({
      test: {
        ...sharedTest,
        environment: "happy-dom",
      },
    }),
    defineConfig(overrides)
  );
