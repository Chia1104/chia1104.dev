import * as z from "zod";

import { setSearchParams } from "@chia/utils/request";
import { getClientIP } from "@chia/utils/server";

import { ErrorCode, X_CAPTCHA_RESPONSE } from "./constants";
import { env } from "./env";

/** reCAPTCHA and Turnstile share this shape; a failed check omits the timestamp and hostname. */
const siteverifyResponseSchema = z.object({
  success: z.boolean(),
  challenge_ts: z.string().optional(),
  hostname: z.string().optional(),
  "error-codes": z.array(z.string()).optional(),
});

interface Options {
  onError?: (code: ErrorCode) => void;
}

export class CaptchaError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode) {
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

  return siteverifyResponseSchema.parse(await siteverify.json());
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

  return siteverifyResponseSchema.parse(await siteverify.json());
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
      const _exhaustive: never = provider;
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
