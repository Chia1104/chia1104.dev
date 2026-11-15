"use client";

import { useLocale } from "next-intl";

import meta from "@chia/meta";
import DateFormat from "@chia/ui/date-format";

export const Copyright = ({ className }: { className?: string }) => {
  const locale = useLocale();
  return (
    <span className={className}>
      © <DateFormat date={undefined} format="YYYY" locale={locale} />{" "}
      <span className="font-medium">{meta.name}</span>
    </span>
  );
};
