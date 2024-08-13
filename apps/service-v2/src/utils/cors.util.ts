import { env } from "@/env";

export const getCORSAllowedOrigin = (): string[] | string => {
  if (!env.CORS_ALLOWED_ORIGIN) return "";
  return (
    env.CORS_ALLOWED_ORIGIN?.split(",").map((item) => {
      return item.trim();
    }) ?? ""
  );
};
