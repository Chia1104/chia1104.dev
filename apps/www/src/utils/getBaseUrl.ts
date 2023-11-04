import { BASE_URL } from "@/shared/constants";
import { env } from "@/env.mjs";

interface Options {
  isServer?: boolean;
}

export const getBaseUrl = (options?: Options) => {
  options ??= {};
  const { isServer } = options;
  if (typeof window !== "undefined" && !isServer) {
    return "";
  }

  if (env.RAILWAY_URL) {
    return `https://${RAILWAY_URL.replace(/\/$/, "")}`; // remove trailing slash
  }

  if (env.VERCEL_URL) {
    return `https://${VERCEL_URL.replace(/\/$/, "")}`;
  }

  if (env.ZEABUR_URL) {
    return `https://${ZEABUR_URL.replace(/\/$/, "")}`;
  }

  return BASE_URL.replace(/\/$/, "");
};
