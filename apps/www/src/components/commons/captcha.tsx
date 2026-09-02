"use client";

import dynamic from "next/dynamic";

import { useLocale } from "next-intl";

import type { CaptchaProps } from "@chia/ui/captcha";
import { cn } from "@chia/ui/utils/cn.util";
import useTheme from "@chia/ui/utils/use-theme";

import { env } from "@/env";

const Captcha = dynamic(
  () => import("@chia/ui/captcha").then((module) => module.Captcha),
  { ssr: false }
);

/** The site's challenge widget, bound to its provider, site key, theme and locale. */
export const SiteCaptcha = ({
  className,
  onToken,
}: Pick<CaptchaProps, "className" | "onToken">) => {
  const { isDarkMode } = useTheme();
  const locale = useLocale();

  return (
    <Captcha
      className={cn(
        env.NEXT_PUBLIC_CAPTCHA_PROVIDER === "google-recaptcha" &&
          "recaptcha-style",
        className
      )}
      language={locale}
      onToken={onToken}
      provider={env.NEXT_PUBLIC_CAPTCHA_PROVIDER}
      siteKey={env.NEXT_PUBLIC_CAPTCHA_SITE_KEY}
      theme={isDarkMode ? "dark" : "light"}
    />
  );
};
