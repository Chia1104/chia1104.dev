import { setSearchParams } from "@chia/utils/request";
import { getClientIP } from "@chia/utils/server";

import { ErrorCode, X_CAPTCHA_RESPONSE } from "./constants";
import type { ErrorCode as CaptchaErrorCode } from "./constants";
import { env } from "./env";

export interface CapthcaResponse {
  success: boolean;
  challenge_ts: string;
  hostname: string;
  "error-codes": string[];
}

interface Options {
  onError?: (code: CaptchaErrorCode) => void;
}

export class CaptchaError extends Error {
  code: CaptchaErrorCode;
  constructor(code: CaptchaErrorCode) {
    super("Captcha Error");
    this.code = code;
  }
}

export interface CaptchaCredentials {
  token: string;
  remoteip: string;
}

const captchaRequestDTO = (credentials: CaptchaCredentials) => ({
  secret: env.CAPTCHA_SECRET_KEY,
  response: credentials.token,
  remoteip: credentials.remoteip,
});

const reCAPTCHASiteverify = async (credentials: CaptchaCredentials) => {
  const siteverify = await fetch(
    setSearchParams(captchaRequestDTO(credentials), {
      baseUrl: "https://www.google.com/recaptcha/api/siteverify",
    }),
    {
      method: "POST",
    }
  );

  const siteverifyJson =
    /* SAFETY: The producer contract guarantees this value satisfies CapthcaResponse. */ (await siteverify.json()) as CapthcaResponse;

  return siteverifyJson;
};

const turnstileSiteverify = async (credentials: CaptchaCredentials) => {
  const formData = new FormData();
  const requestDTO = captchaRequestDTO(credentials);
  formData.append("secret", requestDTO.secret);
  formData.append("response", requestDTO.response);
  formData.append("remoteip", requestDTO.remoteip);

  const siteverify = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: formData,
    }
  );

  const siteverifyJson =
    /* SAFETY: The producer contract guarantees this value satisfies CapthcaResponse. */ (await siteverify.json()) as CapthcaResponse;

  return siteverifyJson;
};

/** Verifies an extracted captcha token. Wired to `captchaPolicy` in `@chia/service-kit`. */
export const captchaSiteverifyWithCredentials = async (
  credentials: CaptchaCredentials,
  options?: Options
) => {
  const provider = env.NEXT_PUBLIC_CAPTCHA_PROVIDER;
  switch (provider) {
    case "cloudflare-turnstile":
      return await turnstileSiteverify(credentials);
    case "google-recaptcha":
      return await reCAPTCHASiteverify(credentials);
    default: {
      options?.onError?.(ErrorCode.CaptchaProviderNotSupported);
      throw new CaptchaError(ErrorCode.CaptchaProviderNotSupported);
    }
  }
};

export const captchaSiteverify = async (
  request: Request,
  options?: Options
) => {
  const token = request.headers.get(X_CAPTCHA_RESPONSE);

  if (!token) {
    options?.onError?.(ErrorCode.CaptchaRequired);
    throw new CaptchaError(ErrorCode.CaptchaRequired);
  }

  return await captchaSiteverifyWithCredentials(
    { token, remoteip: getClientIP(request) },
    options
  );
};
