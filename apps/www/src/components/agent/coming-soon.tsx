"use client";

import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

import { CHBot } from "@/components/commons/ch-bot";

const FEATURES = [
  { key: "search", icon: "i-mdi-magnify" },
  { key: "read", icon: "i-mdi-book-open-page-variant-outline" },
  { key: "profile", icon: "i-mdi-account-outline" },
  { key: "feedback", icon: "i-mdi-comment-edit-outline" },
] as const;

/** Shown while the public kind is still gated to the operator: the visitor is signed in, the kind refuses them. */
export const ComingSoon = () => {
  const t = useTranslations("chbot.comingSoon");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <div className="relative">
        <span
          aria-hidden
          className="absolute inset-0 -z-10 scale-150 rounded-full bg-[radial-gradient(circle,rgb(252_165_165/0.35),transparent_70%)] blur-2xl dark:bg-[radial-gradient(circle,rgb(192_132_252/0.35),transparent_70%)]"
        />
        <CHBot className="size-28 rounded-full" />
      </div>

      <div className="flex flex-col items-center gap-3">
        <Chip color="accent" size="sm" variant="soft">
          <Chip.Label>{t("badge")}</Chip.Label>
        </Chip>
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          {t("title")}
        </h2>
        <p className="text-muted max-w-[38ch] text-sm leading-relaxed">
          {t("description")}
        </p>
      </div>

      <ul className="grid w-full max-w-sm gap-2 text-left">
        {FEATURES.map((feature) => (
          <li
            key={feature.key}
            className="bg-surface-secondary/60 flex items-center gap-3 rounded-xl px-3.5 py-2.5">
            <span className="bg-accent/10 text-accent flex size-8 shrink-0 items-center justify-center rounded-lg">
              <span aria-hidden className={`${feature.icon} size-4`} />
            </span>
            <span className="text-foreground text-sm">
              {t(`features.${feature.key}`)}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-muted text-xs">{t("note")}</p>
    </div>
  );
};
