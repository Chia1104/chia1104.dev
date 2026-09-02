/** Shared by the verifier and by browser code that sends a token; carries no env or provider round trip. */

export const X_CAPTCHA_RESPONSE = "x-captcha-response";

export const ErrorCode = {
  CaptchaRequired: "CAPTCHA_REQUIRED",
  CaptchaProviderNotSupported: "CAPTCHA_PROVIDER_NOT_SUPPORTED",
  CaptchaFailed: "CAPTCHA_FAILED",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
