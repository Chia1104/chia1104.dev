import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export const env = createEnv({
  client: {
    NEXT_PUBLIC_CAPTCHA_PROVIDER: z
      .enum(["cloudflare-turnstile", "google-recaptcha"])
      .default("google-recaptcha"),
    NEXT_PUBLIC_CAPTCHA_SITE_KEY: z.string().min(1),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: {
    NEXT_PUBLIC_CAPTCHA_PROVIDER:
      process.env.NEXT_PUBLIC_CAPTCHA_PROVIDER ?? "google-recaptcha",
    NEXT_PUBLIC_CAPTCHA_SITE_KEY:
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test"
        ? process.env.NEXT_PUBLIC_CAPTCHA_PROVIDER === "google-recaptcha"
          ? "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
          : "1x00000000000000000000AA"
        : process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.APP_CODE !== "service",
});
