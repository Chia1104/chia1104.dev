"use client";

import Image from "next/image";

import { useTranslations } from "next-intl";

import meta from "@chia/meta";
import { cn } from "@chia/ui/utils/cn.util";

import { useModeTransition } from "@/components/commons/mode-transition";
import { Link } from "@/libs/i18n/navigation";
import {
  otherSiteModeOf,
  SITE_MODE_FACE,
  SITE_MODE_HOME,
} from "@/shared/site-mode";
import type { SiteMode } from "@/shared/site-mode";

/** Largest box a face is shown in; smaller ones downscale the same file. */
const FACE_SIZE = 112;

/**
 * The portrait of the mode it sits in, which is also the way out of it: hovering shows the other
 * mode's portrait and a click switches behind the curtain. It stays a link to the other mode's
 * home, so opening it in a new tab or without scripts still works. Size and shape come from
 * `className`.
 */
export const ModeSwitch = ({
  mode,
  className,
}: {
  mode: SiteMode;
  className?: string;
}) => {
  const t = useTranslations("mode");
  const { prepare, switchTo } = useModeTransition();
  const target = otherSiteModeOf(mode);
  const label = t("switch-to", { mode: t(target) });

  return (
    <Link
      href={SITE_MODE_HOME[target]}
      aria-label={label}
      title={label}
      data-testid="mode-switch"
      data-mode-switch={target}
      className={cn(
        "group/mode bg-default outline-focus relative block shrink-0 overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2",
        className
      )}
      onPointerEnter={() => prepare(target)}
      onFocus={() => prepare(target)}
      onClick={(event) => {
        // A modified click opens the link the browser's way.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        event.preventDefault();
        const box = event.currentTarget.getBoundingClientRect();
        switchTo(target, {
          x: box.left + box.width / 2,
          y: box.top + box.height / 2,
        });
      }}>
      {/* Storage refuses a referrer from another origin, which is every origin but production. */}
      <Image
        src={SITE_MODE_FACE[mode]}
        alt={meta.name}
        width={FACE_SIZE}
        height={FACE_SIZE}
        loading="eager"
        referrerPolicy="no-referrer"
        className="size-full object-cover"
      />
      <Image
        src={SITE_MODE_FACE[target]}
        alt=""
        aria-hidden
        width={FACE_SIZE}
        height={FACE_SIZE}
        referrerPolicy="no-referrer"
        className="absolute inset-0 size-full object-cover transition-[clip-path] duration-300 ease-out [clip-path:inset(100%_0_0_0)] group-hover/mode:[clip-path:inset(0)] group-focus-visible/mode:[clip-path:inset(0)] motion-reduce:transition-none"
      />
    </Link>
  );
};
