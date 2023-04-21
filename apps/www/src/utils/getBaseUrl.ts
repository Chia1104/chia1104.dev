import {
  BASE_URL,
  RAILWAY_URL,
  VERCEL_URL,
  ZEABUR_URL,
} from "@/shared/constants";

interface Options {
  isServer?: boolean;
}

export const getBaseUrl = (options?: Options) => {
  options ??= {};
  const { isServer } = options;
  if (typeof window !== "undefined" && !isServer) {
    return "";
  }

  if (RAILWAY_URL) {
    return `https://${RAILWAY_URL.replace(/\/$/, "")}`; // remove trailing slash
  }

  if (VERCEL_URL) {
    return `https://${VERCEL_URL.replace(/\/$/, "")}`;
  }

  if (ZEABUR_URL) {
    return `https://${ZEABUR_URL.replace(/\/$/, "")}`;
  }

  return BASE_URL.replace(/\/$/, "");
};
