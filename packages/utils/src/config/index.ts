import type { Env } from "../schema";

const getInternalEnv = () => {
  if (process.env.ENV) {
    return process.env.ENV;
  }
  if (process.env.NEXT_PUBLIC_ENV) {
    return process.env.NEXT_PUBLIC_ENV;
  }
  if (process.env.NEXT_PUBLIC_VERCEL_ENV) {
    return process.env.NEXT_PUBLIC_VERCEL_ENV;
  }
  if (process.env.RAILWAY_ENVIRONMENT_NAME) {
    return process.env.RAILWAY_ENVIRONMENT_NAME === "production"
      ? "railway-prod"
      : "railway-dev";
  }
  if (process.env.ZEABUR_ENVIRONMENT_NAME) {
    return process.env.ZEABUR_ENVIRONMENT_NAME === "production"
      ? "zeabur-prod"
      : "zeabur-dev";
  }
};

export const getEnv = (env?: string) =>
  (env ??
    process.env.VERCEL_ENV ??
    getInternalEnv() ??
    process.env.NODE_ENV ??
    "local") as Env;

export const switchEnv = <TResult = unknown>(
  env: string | undefined,
  {
    prod,
    beta,
    local,
  }: {
    prod: () => TResult;
    beta: () => TResult;
    local: () => TResult;
  }
) => {
  switch (getEnv(env)) {
    case "railway-prod":
    case "zeabur-prod":
    case "production":
    case "prod": {
      return prod();
    }
    case "railway-dev":
    case "zeabur-dev":
    case "preview":
    case "beta": {
      return beta();
    }
    case "test":
    case "development":
    case "local": {
      return local();
    }
    default:
      throw new Error(`Unknown env: ${env}`);
  }
};

export const getDb = <DB = unknown>(
  env: string | undefined,
  {
    db,
    betaDb,
    localDb,
  }: {
    db: DB;
    betaDb: DB;
    localDb: DB;
  }
) => {
  return switchEnv(env, {
    prod: () => db,
    beta: () => betaDb,
    local: () => localDb,
  });
};

export const getDbUrl = (env?: string) => {
  return switchEnv(env, {
    prod: () => {
      if (!process.env.DATABASE_URL)
        throw new Error("Missing env variables DATABASE_URL");
      return process.env.DATABASE_URL;
    },
    beta: () => {
      if (!process.env.BETA_DATABASE_URL)
        throw new Error("Missing env variables BETA_DATABASE_URL");
      return process.env.BETA_DATABASE_URL;
    },
    local: () => {
      if (!process.env.LOCAL_DATABASE_URL)
        throw new Error("Missing env variables LOCAL_DATABASE_URL");
      return process.env.LOCAL_DATABASE_URL;
    },
  });
};

export const getAdminId = (env?: string) => {
  return switchEnv(env, {
    prod: () => {
      if (!process.env.ADMIN_ID)
        throw new Error("Missing env variables ADMIN_ID");
      return process.env.ADMIN_ID;
    },
    beta: () => {
      if (!process.env.BETA_ADMIN_ID)
        throw new Error("Missing env variables BETA_ADMIN_ID");
      return process.env.BETA_ADMIN_ID;
    },
    local: () => {
      if (!process.env.LOCAL_ADMIN_ID)
        throw new Error("Missing env variables LOCAL_ADMIN_ID");
      return process.env.LOCAL_ADMIN_ID;
    },
  });
};

export const getBaseUrl = (options?: {
  isServer?: boolean;
  baseUrl?: string;
}) => {
  options ??= {};
  const { isServer, baseUrl = `http://localhost:${process.env.PORT ?? 3000}` } =
    options;
  if (typeof window !== "undefined" && !isServer) {
    return "";
  }

  const RAILWAY_URL =
    process.env.RAILWAY_STATIC_URL ?? process.env.RAILWAY_PUBLIC_DOMAIN;

  if (RAILWAY_URL) {
    return `https://${RAILWAY_URL.replace(/\/$/, "")}`; // remove trailing slash
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }

  /**
   * @TODO
   */
  if (process.env.ZEABUR_URL) {
    return `https://${process.env.ZEABUR_URL.replace(/\/$/, "")}`;
  }

  return baseUrl?.replace(/\/$/, "");
};

/**
 * @TODO protential bug, server env will be leaked to client
 */
export default {
  ENV: getEnv(),
  // DATABASE_URL: getDbUrl(),
  // ADMIN_ID: getAdminId(),
  // BASE_URL: getBaseUrl(),
};
