"use client";

import { useTranslations } from "next-intl";

import { ComingSoon } from "./coming-soon";
import { SignInProviders } from "./sign-in-providers";

/**
 * The kind admits signed-in people but not guests. The preview of what the agent does sits
 * behind; the sign-in sheet rises from the bottom over a frosted gradient so the preview
 * stays legible above it.
 */
export const SignInRequired = () => {
  const t = useTranslations("chbot.signInRequired");

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-56">
        <ComingSoon preview />
      </div>

      <section
        aria-labelledby="chbot-sign-in-title"
        className="absolute inset-x-0 bottom-0 isolate flex flex-col items-center gap-4 px-6 pt-24 pb-6 text-center">
        <div
          aria-hidden
          className="from-background via-background/85 pointer-events-none absolute inset-0 -z-10 bg-linear-to-t to-transparent [mask-image:linear-gradient(to_top,black_65%,transparent)] backdrop-blur-lg"
        />
        <div className="flex flex-col gap-1">
          <h2
            id="chbot-sign-in-title"
            className="text-foreground text-base font-semibold">
            {t("title")}
          </h2>
          <p className="text-muted max-w-[36ch] text-sm">{t("description")}</p>
        </div>
        <SignInProviders className="flex w-full max-w-xs flex-col gap-3" />
      </section>
    </div>
  );
};
