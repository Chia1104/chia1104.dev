import * as z from "zod";

export const OAuthProvider = {
  Google: "google",
  GitHub: "github",
} as const;

export type OAuthProvider = (typeof OAuthProvider)[keyof typeof OAuthProvider];

export const oauthProviderSchema = z.enum(OAuthProvider);
