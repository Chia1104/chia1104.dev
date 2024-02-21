import env from "@/config/env";

export const getCORSAllowedOrigin = (): string[] | boolean => {
  if (!env().CORS_ALLOWED_ORIGIN) return false;
  return env()
    .CORS_ALLOWED_ORIGIN.split(",")
    .map((item) => {
      return item.trim();
    });
};
