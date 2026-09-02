import { github, image, preserve, ref, service } from "railway/iac";

import {
  dashboardWatchPatterns,
  region,
  serviceWatchPatterns,
  workflowWatchPatterns,
} from "../config.ts";
import {
  createApiEnv,
  createDashboardEnv,
  createManagedVolume,
  createParadeDbResources,
  createRedisResources,
  createWorkflowEnv,
} from "../resources.ts";

export const createProductionResources = () => {
  const repository = github("Chia1104/chia1104.dev", {
    branch: "main",
    checkSuites: false,
  });
  const paradeDb = createParadeDbResources({
    serviceName: "ParadeDB",
    volumeName: "paradedb-volume-prod",
  });
  const redisResources = createRedisResources();
  const dbStudioVolume = createManagedVolume("db-studio-volume");

  const workflow = service("workflow", {
    source: repository,
    build: {
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "/apps/workflow/Dockerfile",
      watchPatterns: workflowWatchPatterns,
    },
    replicas: { [region]: 1 },
    env: createWorkflowEnv(),
  });

  const api = service("service", {
    source: repository,
    build: {
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "/apps/service/Dockerfile",
      watchPatterns: serviceWatchPatterns,
    },
    replicas: { [region]: 1 },
    deploy: {
      restartPolicyMaxRetries: 10,
      restartPolicyType: "ON_FAILURE",
      sleepApplication: false,
    },
    domains: [{ domain: "service.chia1104.dev", port: 8080 }],
    env: {
      ...createApiEnv(),
      AI_GATEWAY_API_KEY: preserve(),
      APP_ENV: preserve(),
      CACHE_URI: preserve(),
      SPOTIFY_TOKEN_ENCRYPTION_KEY: preserve(),
    },
  });

  const dashboard = service("dash", {
    source: repository,
    build: {
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "/apps/dash/Dockerfile",
      watchPatterns: dashboardWatchPatterns,
    },
    replicas: { [region]: 1 },
    deploy: {
      restartPolicyMaxRetries: 10,
      restartPolicyType: "ON_FAILURE",
      sleepApplication: true,
    },
    domains: [{ domain: "dash.chia1104.dev", port: 8080 }],
    env: {
      ...createDashboardEnv(),
      // The login form's widget must be the provider `service` verifies against.
      NEXT_PUBLIC_CAPTCHA_PROVIDER: ref(api, "NEXT_PUBLIC_CAPTCHA_PROVIDER"),
      NEXT_PUBLIC_CAPTCHA_SITE_KEY: preserve(),
    },
  });

  const dbStudio = service("DB Studio", {
    source: image("ghcr.io/drizzle-team/gateway"),
    replicas: { [region]: 1 },
    deploy: { sleepApplication: true },
    networking: { privateNetworkEndpoint: "db-studio" },
    volumeMounts: { "/app": dbStudioVolume },
    env: {
      GATEWAY_PASSWORD: preserve(),
      MASTERPASS: preserve(),
      PASSWORD: preserve(),
      PORT: preserve(),
    },
  });

  const pgDumpCron = service("PG Dump CRON", {
    source: github("Chia1104/chia1104.dev", {
      branch: "main",
      checkSuites: false,
      rootDirectory: "/apps/functions/pg-dump-cron",
    }),
    build: {
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "/apps/functions/pg-dump-cron/Dockerfile",
      watchPatterns: ["/apps/functions/pg-dump-cron/**"],
    },
    replicas: { [region]: 1 },
    deploy: {
      cronSchedule: "0 0 * * *",
      restartPolicyType: "NEVER",
    },
    networking: { privateNetworkEndpoint: "chia1104dev" },
    env: {
      PGDATABASE: preserve(),
      PGHOST: preserve(),
      PGPASSWORD: preserve(),
      PGPORT: preserve(),
      PGUSER: preserve(),
      R2_ACCESS_KEY_ID: preserve(),
      R2_BUCKET_NAME: preserve(),
      R2_ENDPOINT: preserve(),
      R2_SECRET_ACCESS_KEY: preserve(),
    },
  });

  return [
    paradeDb.database,
    dbStudio,
    workflow,
    api,
    dashboard,
    pgDumpCron,
    redisResources.database,
    redisResources.storage,
    paradeDb.storage,
    dbStudioVolume,
  ];
};
