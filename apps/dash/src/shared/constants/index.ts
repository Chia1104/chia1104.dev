export const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const IS_TEST = process.env.NODE_ENV === "test";

// Site url
export const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://dash.chia1104.dev"
    : "http://localhost:3001";
