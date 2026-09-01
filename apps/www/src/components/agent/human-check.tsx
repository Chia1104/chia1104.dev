"use client";

import { useState } from "react";

import { Spinner } from "@heroui/react";
import { useTranslations } from "next-intl";

import { SiteCaptcha } from "@/components/commons/captcha";

import { useStartGuest } from "./use-chat-session";

/** First visit: a challenge, then a guest session. A failed attempt remounts the widget for a fresh token. */
export const HumanCheck = () => {
  const t = useTranslations("chbot.humanCheck");
  const startGuest = useStartGuest();
  const [attempt, setAttempt] = useState(0);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="bg-accent/10 text-accent flex size-12 items-center justify-center rounded-full">
        <span aria-hidden className="i-mdi-shield-check-outline size-6" />
      </span>
      <div>
        <h2 className="text-foreground text-lg font-semibold">{t("title")}</h2>
        <p className="text-muted mt-1 max-w-[36ch] text-sm">
          {t("description")}
        </p>
      </div>
      {startGuest.isPending ? (
        <Spinner aria-label={t("starting")} size="sm" />
      ) : (
        <SiteCaptcha
          key={attempt}
          onToken={(token) => {
            if (!token) return;
            startGuest.mutate(token, {
              onError: () => setAttempt((count) => count + 1),
            });
          }}
        />
      )}
      {startGuest.isError ? (
        <p className="text-danger text-sm">{t("failed")}</p>
      ) : null}
    </div>
  );
};
