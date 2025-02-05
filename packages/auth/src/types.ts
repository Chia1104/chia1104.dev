import { z } from "zod";

import type { auth } from "./";

export const Provider = {
  google: "google",
  github: "github",
  resend: "resend",
} as const;

export type Provider = (typeof Provider)[keyof typeof Provider];

export const providerSchema = z.nativeEnum(Provider);

export type Session = typeof auth.$Infer.Session;
