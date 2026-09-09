"use client";

import { useTranslations } from "next-intl";

import { SignInProviders } from "./sign-in-providers";

/** The kind admits signed-in people but not guests: the visitor holds a guest session and must sign in to continue. */
export const SignInRequired = () => {
  const t = useTranslations("chbot.signInRequired");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="bg-accent/10 text-accent flex size-12 items-center justify-center rounded-full">
        <span aria-hidden className="i-mdi-login size-6" />
      </span>
      <div>
        <h2 className="text-foreground text-base font-semibold">
          {t("title")}
        </h2>
        <p className="text-muted mt-1 max-w-[36ch] text-sm">
          {t("description")}
        </p>
      </div>
      <SignInProviders className="flex w-full max-w-xs flex-col gap-3" />
    </div>
  );
};
