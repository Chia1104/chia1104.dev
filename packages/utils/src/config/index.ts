import type { AppEnv } from "../schema";
import { Service } from "../schema";
import { serviceEnv } from "./env";

const getInternalEnv = () => {
  if (process.env.ENV || process.env.APP_ENV) {
    return process.env.ENV || process.env.APP_ENV;
  }
  if (process.env.NEXT_PUBLIC_ENV || process.env.NEXT_PUBLIC_APP_ENV) {
    return process.env.NEXT_PUBLIC_ENV || process.env.NEXT_PUBLIC_APP_ENV;
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

export const getEnv = (env?: string): AppEnv =>
  (env ??
    process.env.VERCEL_ENV ??
    getInternalEnv() ??
    process.env.NODE_ENV ??
    "local") as AppEnv;

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

type ServiceVersion = "v1" | "NO_PREFIX" | "LEGACY";

interface GetServiceEndPointOptions {
  clientPrefix?: string;
  proxyEndpoint?: string;
  version?: ServiceVersion;
  isInternal?: boolean;
  removePrefix?: boolean;
}

function removeEndSlash(url: string) {
  return url.replace(/\/$/, "");
}

function switchServiceVersion(version: ServiceVersion, url: string) {
  switch (version) {
    case "LEGACY":
    case "v1":
      return removeEndSlash(url) + "/api/v1";
    default:
      return removeEndSlash(url);
  }
}

/**
 * @deprecated Use`withServiceEndpoint` instead
 * the url of the service endpoint (including the protocol)
 * @param env
 * @param options {proxyEndpoint, version, isInternal}
 * @default version = "v1"
 * if you are use `v1` version, the url path will be `/api/v1` (e.g. `https://example.com/api/v1`)
 */
export const getServiceEndPoint = (
  env?: string,
  options?: GetServiceEndPointOptions
) => {
  const isServer = typeof window === "undefined";
  const {
    proxyEndpoint = process.env.NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT,
    version = "v1",
    isInternal,
  } = options ?? {};
  return switchEnv(env, {
    prod: () => {
      if (isServer || isInternal) {
        if (!process.env.INTERNAL_SERVICE_ENDPOINT)
          throw new Error("Missing env variables INTERNAL_SERVICE_ENDPOINT");
        return switchServiceVersion(
          version,
          process.env.INTERNAL_SERVICE_ENDPOINT
        );
      }
      if (proxyEndpoint) {
        return switchServiceVersion(version, proxyEndpoint);
      }
      const serviceEndpoint = process.env.NEXT_PUBLIC_SERVICE_ENDPOINT;
      if (!serviceEndpoint)
        throw new Error(`Missing env variables NEXT_PUBLIC_SERVICE_ENDPOINT`);
      return switchServiceVersion(version, serviceEndpoint);
    },
    beta: () => {
      if (isServer || isInternal) {
        if (!process.env.INTERNAL_SERVICE_ENDPOINT)
          throw new Error("Missing env variables INTERNAL_SERVICE_ENDPOINT");
        return switchServiceVersion(
          version,
          process.env.INTERNAL_SERVICE_ENDPOINT
        );
      }
      const serviceEndpoint = process.env.NEXT_PUBLIC_SERVICE_ENDPOINT;
      if (!serviceEndpoint)
        throw new Error(`Missing env variables NEXT_PUBLIC_SERVICE_ENDPOINT`);
      return switchServiceVersion(version, serviceEndpoint);
    },
    local: () => {
      if (isServer || isInternal) {
        if (!process.env.INTERNAL_SERVICE_ENDPOINT)
          throw new Error("Missing env variables INTERNAL_SERVICE_ENDPOINT");
        return switchServiceVersion(
          version,
          process.env.INTERNAL_SERVICE_ENDPOINT
        );
      }
      const serviceEndpoint = process.env.NEXT_PUBLIC_SERVICE_ENDPOINT;
      if (!serviceEndpoint)
        throw new Error(`Missing env variables NEXT_PUBLIC_SERVICE_ENDPOINT`);
      return switchServiceVersion(version, serviceEndpoint);
    },
  });
};

export const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const IS_TEST = process.env.NODE_ENV === "test";

export const WWW_BASE_URL =
  getEnv() === "production" || getEnv() === "prod"
    ? "https://www.chia1104.dev"
    : "http://localhost:3000";

export const DASH_BASE_URL =
  getEnv() === "production" || getEnv() === "prod"
    ? "https://dash.chia1104.dev"
    : "http://localhost:3001";

export const CONTACT_EMAIL = "contact@notify.chia1104.dev";
export const AUTH_EMAIL = "no-reply@notify.chia1104.dev";

interface WithServiceEndpointOptions {
  isInternal?: boolean;
  version?: ServiceVersion;
}

function serviceNameResolver(service: Service) {
  switch (service) {
    case Service.LegacyService:
      return "SERVICE";
    case Service.Auth:
      return "AUTH_SERVICE";
    case Service.Content:
      return "CONTENT_SERVICE";
    case Service.AI:
      return "AI_SERVICE";
  }
}

const getServicePrefixUrl = (service: Service, isInternal?: boolean) => {
  if (isInternal) {
    return (
      serviceEnv[`INTERNAL_${serviceNameResolver(service)}_ENDPOINT`] ?? ""
    );
  }
  return (
    serviceEnv.NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT ??
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    serviceEnv.NEXT_PUBLIC_SERVICE_ENDPOINT ??
    ""
  );
};

export const withServiceEndpoint = (
  path: string,
  service: Service,
  options?: WithServiceEndpointOptions
) => {
  const isServer = typeof window === "undefined";
  const {
    isInternal,
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    version = !!serviceEnv.INTERNAL_SERVICE_ENDPOINT ||
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    !!serviceEnv.NEXT_PUBLIC_SERVICE_ENDPOINT
      ? "LEGACY"
      : "NO_PREFIX",
  } = options ?? {};

  return `${switchServiceVersion(
    version,
    getServicePrefixUrl(service, isInternal || isServer)
  )}${path.startsWith("/") ? path : `/${path}`}`;
};
