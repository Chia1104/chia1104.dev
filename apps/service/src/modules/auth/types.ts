import { z } from "zod";

/**
 * https://authjs.dev/guides/pages/error
 */
export const AuthError = {
  Configuration: "Configuration",
  AccessDenied: "AccessDenied",
  Verification: "Verification",
  Default: "Default",
} as const;

export type AuthError = (typeof AuthError)[keyof typeof AuthError];

export const authErrorSchema = z.nativeEnum(AuthError);

export const OAuthProvider = {
  Google: "google",
  GitHub: "github",
  Spotify: "spotify",
} as const;

export type OAuthProvider = (typeof OAuthProvider)[keyof typeof OAuthProvider];

export const oAuthProviderSchema = z.nativeEnum(OAuthProvider);
