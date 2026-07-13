"use client";

import Image from "next/image";

import { Locale } from "@/libs/utils/i18n";

interface RelatedFeedsImageBackgroundProps {
  locale: Locale;
  type: string;
  slug: string;
  token: string;
}

export function RelatedFeedsImageBackground({
  locale,
  type,
  slug,
  token,
}: RelatedFeedsImageBackgroundProps) {
  const localePrefix = locale === Locale.ZH_TW ? "" : `/${locale}`;

  return (
    <Image
      alt=""
      src={`${localePrefix}/${type}/${slug}/og?token=${token}`}
      width={1200}
      height={630}
      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );
}
