import { z } from "zod";

export const Provider = {
  google: "google",
  github: "github",
  resend: "resend",
} as const;

export type Provider = (typeof Provider)[keyof typeof Provider];

export const providerSchema = z.nativeEnum(Provider);

export type { Session } from "@auth/core/types";
