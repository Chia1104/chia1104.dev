"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Spinner } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { X_CAPTCHA_RESPONSE } from "@chia/api/captcha/constants";
import { authClient } from "@chia/auth/client";

import { SiteCaptcha } from "@/components/commons/captcha";

/** First visit: a challenge, then a guest session. A failed attempt remounts the widget for a fresh token. */
export const HumanCheck = () => {
  const t = useTranslations("chbot.humanCheck");
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();
  const startGuest = useMutation({
    mutationFn: async (token: string) => {
      const response = await authClient.signIn.anonymous({
        fetchOptions: { headers: { [X_CAPTCHA_RESPONSE]: token } },
      });

      if (response.error) {
        throw new Error(response.error.message ?? response.error.statusText);
      }

      return response.data.user;
    },
    onSuccess: () => {
      router.refresh();
    },
  });

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
