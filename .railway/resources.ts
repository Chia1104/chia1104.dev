import { image, preserve, redis, service, volume } from "railway/iac";

import { region } from "./config.ts";

export const createManagedVolume = (name: string) =>
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

export const createParadeDbResources = ({
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

export const createRedisResources = () => {
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

export const createWorkflowEnv = () => ({
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

export const createApiEnv = () => ({
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

export const createDashboardEnv = () => ({
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
