import {
  defineRailway,
  github,
  image,
  preserve,
  project,
  redis,
  service,
  volume,
} from "railway/iac";

const region = "asia-southeast1-eqsg3a";

const createManagedVolume = (name: string) =>
  volume(name, {
    alerts: { usage: { "100": {}, "80": {}, "95": {} } },
    allowOnlineResize: true,
    region,
    sizeMB: 5000,
  });

const createPostgresEnv = () => ({
  DATABASE_PUBLIC_URL: preserve(),
  DATABASE_URL: preserve(),
  PGDATA: preserve(),
  PGDATABASE: preserve(),
  PGHOST: preserve(),
  PGPASSWORD: preserve(),
  PGPORT: preserve(),
  PGUSER: preserve(),
  POSTGRES_DB: preserve(),
  POSTGRES_PASSWORD: preserve(),
  POSTGRES_USER: preserve(),
  RAILWAY_RUN_UID: preserve(),
});

const createParadeDbResources = ({
  serviceName,
  volumeName,
}: {
  serviceName: string;
  volumeName: string;
}) => {
  const storage = createManagedVolume(volumeName);
  const database = service(serviceName, {
    source: image("paradedb/paradedb:latest"),
    start:
      '/bin/sh -c "unset PGHOST; unset PGPORT; exec docker-entrypoint.sh postgres --port=5432 -c listen_addresses=*"',
    replicas: { [region]: 1 },
    networking: { privateNetworkEndpoint: "paradedb" },
    tcp: [5432],
    volumeMounts: { "/var/lib/postgresql/data": storage },
    env: createPostgresEnv(),
  });

  return { database, storage };
};

const createRedisResources = () => {
  const database = redis("Redis", { region });
  database.deploy = {
    startCommand:
      '/bin/sh -c "rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH"',
  };

  return {
    database,
    storage: createManagedVolume("redis-volume"),
  };
};

const createWorkflowEnv = () => ({
  ADMIN_ID: preserve(),
  AI_AUTH_PRIVATE_KEY: preserve(),
  AI_GATEWAY_API_KEY: preserve(),
  APP_CODE: preserve(),
  DATABASE_URL: preserve(),
  ENV: preserve(),
  FIRECRAWL_API_KEY: preserve(),
  INTERNAL_WORKFLOW_SERVICE_TOKEN: preserve(),
  NODE_ENV: preserve(),
  OPENAI_API_KEY: preserve(),
  WORKFLOW_POSTGRES_JOB_PREFIX: preserve(),
  WORKFLOW_POSTGRES_MAX_POOL_SIZE: preserve(),
  WORKFLOW_POSTGRES_URL: preserve(),
  WORKFLOW_POSTGRES_WORKER_CONCURRENCY: preserve(),
  WORKFLOW_REDIS_URI: preserve(),
  WORKFLOW_TARGET_WORLD: preserve(),
});

const createApiEnv = () => ({
  ADMIN_ID: preserve(),
  AI_AUTH_PRIVATE_KEY: preserve(),
  AI_AUTH_PUBLIC_KEY: preserve(),
  AI_AUTH_SECRET: preserve(),
  APP_CODE: preserve(),
  AUTH_SECRET: preserve(),
  AUTH_URL: preserve(),
  BETA_ADMIN_ID: preserve(),
  CACHE_PROVIDER: preserve(),
  CAPTCHA_SECRET_KEY: preserve(),
  CORS_ALLOWED_ORIGIN: preserve(),
  DATABASE_URL: preserve(),
  ENV: preserve(),
  FIRECRAWL_API_KEY: preserve(),
  GITHUB_CLIENT_ID: preserve(),
  GITHUB_CLIENT_SECRET: preserve(),
  GOOGLE_CLIENT_ID: preserve(),
  GOOGLE_CLIENT_SECRET: preserve(),
  INTERNAL_WORKFLOW_SERVICE_ENDPOINT: preserve(),
  INTERNAL_WORKFLOW_SERVICE_TOKEN: preserve(),
  IP_DENY_LIST: preserve(),
  MAINTENANCE_BYPASS_TOKEN: preserve(),
  MAINTENANCE_MODE: preserve(),
  NEXT_PUBLIC_CAPTCHA_PROVIDER: preserve(),
  OPENAI_API_KEY: preserve(),
  REDIS_URI: preserve(),
  RESEND_API_KEY: preserve(),
  S3_ACCESS_KEY_ID: preserve(),
  S3_BUCKET_NAME: preserve(),
  S3_ENDPOINT: preserve(),
  S3_REGION: preserve(),
  S3_SECRET_ACCESS_KEY: preserve(),
  SPOTIFY_CLIENT_ID: preserve(),
  SPOTIFY_CLIENT_SECRET: preserve(),
  SPOTIFY_REDIRECT_URI: preserve(),
  WORKFLOW_POSTGRES_JOB_PREFIX: preserve(),
  WORKFLOW_POSTGRES_URL: preserve(),
  WORKFLOW_POSTGRES_WORKER_CONCURRENCY: preserve(),
  WORKFLOW_REDIS_URI: preserve(),
  WORKFLOW_TARGET_WORLD: preserve(),
});

const createDashboardEnv = () => ({
  ADMIN_ID: preserve(),
  AI_AUTH_SECRET: preserve(),
  APP_CODE: preserve(),
  AUTH_SECRET: preserve(),
  BETA_ADMIN_ID: preserve(),
  BS_TEL_TOKEN: preserve(),
  BS_UPTIME_TOKEN: preserve(),
  CACHE_PROVIDER: preserve(),
  CACHE_URI: preserve(),
  DATABASE_URL: preserve(),
  ENV: preserve(),
  GITHUB_CLIENT_ID: preserve(),
  GITHUB_CLIENT_SECRET: preserve(),
  GOOGLE_CLIENT_ID: preserve(),
  GOOGLE_CLIENT_SECRET: preserve(),
  INTERNAL_SERVICE_ENDPOINT: preserve(),
  NEXT_PUBLIC_ENV: preserve(),
  NEXT_PUBLIC_SERVICE_ENDPOINT: preserve(),
  NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT: preserve(),
  RESEND_API_KEY: preserve(),
  S3_ACCESS_KEY_ID: preserve(),
  S3_BUCKET_NAME: preserve(),
  S3_ENDPOINT: preserve(),
  S3_REGION: preserve(),
  S3_SECRET_ACCESS_KEY: preserve(),
  SPOTIFY_CLIENT_ID: preserve(),
  SPOTIFY_CLIENT_SECRET: preserve(),
  SPOTIFY_REDIRECT_URI: preserve(),
  TEST_ENV: preserve(),
  TURBO_TEAM: preserve(),
  TURBO_TOKEN: preserve(),
});

const createBetaResources = () => {
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
      watchPatterns: ["/apps/service/**"],
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

const createProductionResources = () => {
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
      watchPatterns: ["/apps/service/**"],
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
    },
    replicas: { [region]: 1 },
    deploy: {
      restartPolicyMaxRetries: 10,
      restartPolicyType: "ON_FAILURE",
      sleepApplication: true,
    },
    domains: [{ domain: "dash.chia1104.dev", port: 8080 }],
    env: createDashboardEnv(),
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

export default defineRailway((context) => {
  if (context.isEnvironment("beta")) {
    return project("chia1104.dev", {
      resources: createBetaResources(),
    });
  }

  if (context.isEnvironment("production")) {
    return project("chia1104.dev", {
      resources: createProductionResources(),
    });
  }

  throw new Error(`Unsupported Railway environment: ${context.environment}`);
});
