"use client";

import { useEffect, useRef } from "react";

import { useLocale } from "next-intl";

import { usePathname } from "@/libs/i18n/navigation";
import { client } from "@/libs/orpc/client";
import { dbLocaleResolver } from "@/libs/utils/i18n";

/** Readers who ask not to be tracked are not reported. */
const optedOut = () =>
  navigator.doNotTrack === "1" ||
  ("globalPrivacyControl" in navigator &&
    navigator.globalPrivacyControl === true);

/**
 * Reports each page the reader opens to `stats.view`. The path has no locale prefix, and the
 * referrer is only sent for the page the visit landed on.
 */
export const PageViewTracker = () => {
  const pathname = usePathname();
  const locale = useLocale();
  const landed = useRef(false);

  useEffect(() => {
    if (optedOut()) return;
    const referrer = landed.current ? undefined : document.referrer;
    landed.current = true;
    client.stats
      .view({
        path: pathname,
        locale: dbLocaleResolver(locale),
        referrer: referrer || undefined,
      })
      // A lost view is not worth a report or a retry.
      .catch(() => undefined);
  }, [pathname, locale]);

  return null;
};
