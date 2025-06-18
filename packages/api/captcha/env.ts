import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export const env = createEnv({
  server: {
    NEXT_PUBLIC_CAPTCHA_PROVIDER: z
      .enum(["cloudflare-turnstile", "google-recaptcha"])
      .default("google-recaptcha"),
    CAPTCHA_SECRET_KEY: z.string().min(1),
  },
  runtimeEnv: {
    NEXT_PUBLIC_CAPTCHA_PROVIDER:
      process.env.NEXT_PUBLIC_CAPTCHA_PROVIDER ?? "google-recaptcha",
    CAPTCHA_SECRET_KEY:
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test"
        ? process.env.NEXT_PUBLIC_CAPTCHA_PROVIDER === "google-recaptcha"
          ? "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe"
          : "1x0000000000000000000000000000000AA"
        : process.env.CAPTCHA_SECRET_KEY,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.APP_CODE !== "service",
});
