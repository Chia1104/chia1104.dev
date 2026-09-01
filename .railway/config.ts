export const region = "asia-southeast1-eqsg3a";

const rootBuildWatchPatterns = [
  "/.dockerignore",
  "/package.json",
  "/pnpm-lock.yaml",
  "/pnpm-workspace.yaml",
  "/turbo.json",
];

const backendPackageWatchPatterns = [
  "/packages/agent-content/**",
  "/packages/agent-host/**",
  "/packages/agent-public/**",
  "/packages/agent-runtime/**",
  "/packages/agent-writing/**",
  "/packages/ai/**",
  "/packages/api/**",
  "/packages/auth/**",
  "/packages/db/**",
  "/packages/kv/**",
  "/packages/meta/**",
  "/packages/service-kit/**",
  "/packages/test/**",
  "/packages/ui/**",
  "/packages/utils/**",
  "/packages/workflow-control/**",
];

export const serviceWatchPatterns = [
  "/apps/service/**",
  ...backendPackageWatchPatterns,
  ...rootBuildWatchPatterns,
];

export const workflowWatchPatterns = [
  "/apps/workflow/**",
  ...backendPackageWatchPatterns,
  ...rootBuildWatchPatterns,
];

export const dashboardWatchPatterns = [
  "/apps/dash/**",
  "/packages/agent-elements/**",
  ...backendPackageWatchPatterns,
  "/packages/contents/**",
  "/packages/i18n/**",
  "/packages/tailwind/**",
  "/packages/themes/**",
  ...rootBuildWatchPatterns,
];
