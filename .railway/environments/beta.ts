import { github, preserve, service } from "railway/iac";

import {
  dashboardWatchPatterns,
  region,
  serviceWatchPatterns,
  workflowWatchPatterns,
} from "../config.ts";
import {
  createApiEnv,
  createDashboardEnv,
  createParadeDbResources,
  createRedisResources,
  createWorkflowEnv,
} from "../resources.ts";

export const createBetaResources = () => {
  const repository = github("Chia1104/chia1104.dev", {
    branch: "develop",
    checkSuites: false,
  });
  const paradeDb = createParadeDbResources({
    serviceName: "ParadeDB Beta",
    volumeName: "paradedb-volume-beta",
  });
  const redisResources = createRedisResources();

  const workflow = service("workflow-beta", {
    source: repository,
    build: {
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "/apps/workflow/Dockerfile",
      watchPatterns: workflowWatchPatterns,
    },
    replicas: { [region]: 1 },
    deploy: { sleepApplication: true },
    networking: { privateNetworkEndpoint: "workflow" },
    env: {
      ...createWorkflowEnv(),
      BETA_ADMIN_ID: preserve(),
      BETA_DATABASE_URL: preserve(),
    },
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
    deploy: { sleepApplication: true },
    env: {
      ...createApiEnv(),
      AUTH_COOKIE_DOMAIN: preserve(),
      BETA_DATABASE_URL: preserve(),
      SKIP_ENV_VALIDATION: preserve(),
      SPOTIFY_REFRESH_TOKEN: preserve(),
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
    deploy: { sleepApplication: true },
    env: createDashboardEnv(),
  });

  return [
    workflow,
    api,
    dashboard,
    paradeDb.database,
    redisResources.database,
    paradeDb.storage,
    redisResources.storage,
  ];
};
