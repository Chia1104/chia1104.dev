import { APIError } from "better-auth/api";
import * as z from "zod";

import type { Auth } from "./server.ts";

export const Provider = {
  google: "google",
  github: "github",
  resend: "resend",
} as const;

export type Provider = (typeof Provider)[keyof typeof Provider];

export const providerSchema = z.enum(Provider);

export type Session = Auth["$Infer"]["Session"];

export { APIError };
