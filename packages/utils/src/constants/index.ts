import config from "../config";

export const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const IS_TEST = process.env.NODE_ENV === "test";

export const WWW_BASE_URL =
  config.ENV === "production" || config.ENV === "prod"
    ? "https://chia1104.dev"
    : "http://localhost:3000";

export const DASH_BASE_URL =
  config.ENV === "production" || config.ENV === "prod"
    ? "https://dash.chia1104.dev"
    : "http://localhost:3001";

export const SERVICE_BASE_URL =
  config.ENV === "production" || config.ENV === "prod"
    ? "https://service.chia1104.dev"
    : "http://localhost:3003";

/**
 * @deprecated
 * no longer needed
 */
export const POSTS_PATH = !IS_TEST
  ? IS_PRODUCTION
    ? "./posts/published"
    : "./posts/unpublished"
  : "./posts/examples";
