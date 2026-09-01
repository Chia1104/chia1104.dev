"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import ReCAPTCHA from "react-google-recaptcha";

export type CaptchaProvider = "cloudflare-turnstile" | "google-recaptcha";

export interface CaptchaProps {
  provider: CaptchaProvider;
  siteKey: string;
  theme?: "light" | "dark";
  /** BCP 47 tag the challenge is rendered in. */
  language?: string;
  /** A fresh token, or `null` once the previous one expired. Tokens are single-use. */
  onToken: (token: string | null) => void;
  className?: string;
}

/** Remount (change `key`) after a verified call to obtain another token. */
export const Captcha = ({
  className,
  language,
  onToken,
  provider,
  siteKey,
  theme = "light",
}: CaptchaProps) =>
  provider === "google-recaptcha" ? (
    <div className={className}>
      <ReCAPTCHA
        key={theme}
        hl={language}
        onChange={(value) => onToken(value)}
        onExpired={() => onToken(null)}
        sitekey={siteKey}
        theme={theme}
      />
    </div>
  ) : (
    <Turnstile
      className={className}
      onExpire={() => onToken(null)}
      onSuccess={onToken}
      options={{ theme, language }}
      siteKey={siteKey}
    />
  );
