"use client";

import { useTranslations } from "next-intl";

import { cn } from "@chia/ui/utils/cn.util";

import { Link } from "@/libs/i18n/navigation";
import { SITE_MODE_HOME, SiteMode } from "@/shared/site-mode";

/** Links to each mode's home; `mode` is the frame it sits in. */
export const ModeSwitch = ({
  mode,
  className,
}: {
  mode: SiteMode;
  className?: string;
}) => {
  const t = useTranslations("mode");
  return (
    <nav
      aria-label={t("label")}
      data-testid="mode-switch"
      className={cn(
        "bg-default flex items-center gap-0.5 rounded-lg p-0.5 text-xs font-medium",
        className
      )}>
      {Object.values(SiteMode).map((value) => (
        <Link
          key={value}
          href={SITE_MODE_HOME[value]}
          aria-current={value === mode ? "true" : undefined}
          data-testid={`mode-switch-${value}`}
          className="text-muted hover:text-foreground aria-[current]:bg-segment aria-[current]:text-segment-foreground focus-visible:ring-focus rounded-md px-2.5 py-1 transition-colors outline-none focus-visible:ring-2 aria-[current]:shadow-xs">
          {t(value)}
        </Link>
      ))}
    </nav>
  );
};
