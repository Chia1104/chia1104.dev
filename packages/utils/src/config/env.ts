import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const serviceEnv = createEnv({
  server: {
    /**
     * @deprecated Use INTERNAL_AUTH_SERVICE_ENDPOINT, INTERNAL_CONTENT_SERVICE_ENDPOINT, INTERNAL_AI_SERVICE_ENDPOINT, INTERNAL_LEGACY_SERVICE_ENDPOINT instead
     * @description The **LEGACY** internal service endpoint, only used in server side
     */
    INTERNAL_SERVICE_ENDPOINT: z.string().optional(),
    INTERNAL_AUTH_SERVICE_ENDPOINT: z.string().optional(),
    INTERNAL_CONTENT_SERVICE_ENDPOINT: z.string().optional(),
    INTERNAL_AI_SERVICE_ENDPOINT: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT: z.string().optional(),
    /**
     * @deprecated Use NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT instead
     * @description The **LEGACY** service endpoint, used in client side
     */
    NEXT_PUBLIC_SERVICE_ENDPOINT: z.string().optional(),
  },
  runtimeEnv: {
    INTERNAL_SERVICE_ENDPOINT: process.env.INTERNAL_SERVICE_ENDPOINT,
    NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT:
      process.env.NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT,
    NEXT_PUBLIC_SERVICE_ENDPOINT: process.env.NEXT_PUBLIC_SERVICE_ENDPOINT,
  },
  clientPrefix: "NEXT_PUBLIC_",
  skipValidation: true,
});
