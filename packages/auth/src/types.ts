import { APIError } from "better-auth/api";
import * as z from "zod";

import type { auth } from "./";

export const Provider = {
  google: "google",
  github: "github",
  resend: "resend",
} as const;

export type Provider = (typeof Provider)[keyof typeof Provider];

export const providerSchema = z.enum(Provider);

export type Session = typeof auth.$Infer.Session;

export type Organization = Omit<
  typeof auth.$Infer.Organization,
  "createdAt"
> & {
  /**
   * Date type is only came from better-auth, it should always be a string
   */
  createdAt: string | Date;
};

export { APIError };
