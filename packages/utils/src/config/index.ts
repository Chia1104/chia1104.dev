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

/**
 * @deprecated use `getDB` from `@chia/db`
 * @param env
 * @param db
 * @param betaDb
 * @param localDb
 */
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
  useBaseUrl?: boolean;
}) => {
  options ??= {};
  const {
    isServer,
    baseUrl = `http://localhost:${process.env.PORT ?? 3000}`,
    useBaseUrl,
  } = options;
  if (typeof window !== "undefined" && !isServer) {
    return "";
  }

  if (useBaseUrl) {
    return baseUrl;
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

interface GetServiceEndPointOptions {
  proxyEndpoint?: string;
}

/**
 * the url of the service endpoint (including the protocol)
 * @param env
 */
export const getServiceEndPoint = (
  env?: string,
  options?: GetServiceEndPointOptions
) => {
  const isServer = typeof window === "undefined";
  const { proxyEndpoint = process.env.NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT } =
    options ?? {};
  return switchEnv(env, {
    prod: () => {
      if (isServer) {
        if (!process.env.INTERNAL_SERVICE_ENDPOINT)
          throw new Error("Missing env variables INTERNAL_SERVICE_ENDPOINT");
        return process.env.INTERNAL_SERVICE_ENDPOINT;
      }
      if (proxyEndpoint) {
        return proxyEndpoint;
      }
      if (!process.env.NEXT_PUBLIC_SERVICE_ENDPOINT)
        throw new Error("Missing env variables NEXT_PUBLIC_SERVICE_ENDPOINT");
      return process.env.NEXT_PUBLIC_SERVICE_ENDPOINT;
    },
    beta: () => {
      if (isServer) {
        if (!process.env.INTERNAL_SERVICE_ENDPOINT)
          throw new Error("Missing env variables INTERNAL_SERVICE_ENDPOINT");
        return process.env.INTERNAL_SERVICE_ENDPOINT;
      }
      if (!process.env.NEXT_PUBLIC_SERVICE_ENDPOINT)
        throw new Error("Missing env variables NEXT_PUBLIC_SERVICE_ENDPOINT");
      return process.env.NEXT_PUBLIC_SERVICE_ENDPOINT;
    },
    local: () => {
      if (isServer) {
        if (!process.env.INTERNAL_SERVICE_ENDPOINT)
          throw new Error("Missing env variables INTERNAL_SERVICE_ENDPOINT");
        return process.env.INTERNAL_SERVICE_ENDPOINT;
      }
      if (!process.env.NEXT_PUBLIC_SERVICE_ENDPOINT)
        throw new Error("Missing env variables NEXT_PUBLIC_SERVICE_ENDPOINT");
      return process.env.NEXT_PUBLIC_SERVICE_ENDPOINT;
    },
  });
};

export default {
  ENV: getEnv(),
};
