import { BASE_URL, RAILWAY_URL, VERCEL_URL } from "@chia/shared/constants";

export const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return "";
  }

  if (RAILWAY_URL) {
    return `https://${RAILWAY_URL}`;
  }

  if (VERCEL_URL) {
    return `https://${VERCEL_URL}`;
  }

  return BASE_URL;
};
