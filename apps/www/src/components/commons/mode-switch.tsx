"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { useTranslations } from "next-intl";

import meta from "@chia/meta";
import { AsciiSwap } from "@chia/shaders/ascii-swap";
import type { AsciiSwapPoint } from "@chia/shaders/ascii-swap";
import { cn } from "@chia/ui/utils/cn.util";
import { useIdle } from "@chia/ui/utils/use-idle";

import { useModeTransition } from "@/components/commons/mode-transition";
import { Link } from "@/libs/i18n/navigation";
import { modeFaceOf } from "@/libs/mode-face";
import {
  otherSiteModeOf,
  SITE_MODE_FACE,
  SITE_MODE_HOME,
} from "@/shared/site-mode";
import type { SiteMode } from "@/shared/site-mode";

/** Largest box a face is shown in; smaller ones downscale the same file. */
const FACE_SIZE = 112;

interface Preview {
  hovered: boolean;
  focused: boolean;
  /** Where in the box the pointer came in or went out; `null` for the keyboard. */
  origin: AsciiSwapPoint | null;
}

const pointIn = (
  box: DOMRect,
  event: { clientX: number; clientY: number }
): AsciiSwapPoint => ({
  x: Math.min(box.width, Math.max(0, event.clientX - box.left)),
  y: Math.min(box.height, Math.max(0, event.clientY - box.top)),
});

/**
 * The portrait of the mode it sits in, which is also the way out of it: hovering swaps in the
 * other mode's portrait through a wave of glyphs and a click switches behind the curtain. It
 * stays a link to the other mode's home, so opening it in a new tab or without scripts still
 * works. Size and shape come from `className`.
 */
export const ModeSwitch = ({
  mode,
  className,
}: {
  mode: SiteMode;
  className?: string;
}) => {
  const t = useTranslations("mode");
  const { switchTo } = useModeTransition();
  const isIdle = useIdle();
  const target = otherSiteModeOf(mode);
  const label = t("switch-to", { mode: t(target) });
  const [preview, setPreview] = useState<Preview>({
    hovered: false,
    focused: false,
    origin: null,
  });
  const [faces, setFaces] = useState<{
    own: ImageBitmap | null;
    other: ImageBitmap | null;
  } | null>(null);
  const isPreviewing = preview.hovered || preview.focused;
  // Decoded ahead of the first hover, which would otherwise wait on it mid-swap.
  const wantsFaces = isIdle || isPreviewing;

  useEffect(() => {
    if (!wantsFaces) return;
    let isCurrent = true;
    void Promise.all([modeFaceOf(mode), modeFaceOf(target)]).then(
      ([own, other]) => {
        if (isCurrent) setFaces({ own, other });
      }
    );
    return () => {
      isCurrent = false;
    };
  }, [wantsFaces, mode, target]);

  return (
    <Link
      href={SITE_MODE_HOME[target]}
      aria-label={label}
      title={label}
      data-testid="mode-switch"
      data-mode-switch={target}
      className={cn(
        "bg-default outline-focus relative block shrink-0 overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2",
        className
      )}
      onPointerEnter={(event) => {
        // A touch has no hover: its enter comes with the tap that switches.
        if (event.pointerType === "touch") return;
        const origin = pointIn(
          event.currentTarget.getBoundingClientRect(),
          event
        );
        setPreview((current) => ({ ...current, hovered: true, origin }));
      }}
      onPointerLeave={(event) => {
        const origin = pointIn(
          event.currentTarget.getBoundingClientRect(),
          event
        );
        setPreview((current) => ({ ...current, hovered: false, origin }));
      }}
      onFocus={(event) => {
        if (!event.currentTarget.matches(":focus-visible")) return;
        setPreview((current) => ({ ...current, focused: true, origin: null }));
      }}
      onBlur={() =>
        setPreview((current) => ({ ...current, focused: false, origin: null }))
      }
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
      <AsciiSwap
        active={isPreviewing}
        origin={preview.origin}
        from={faces?.own ?? null}
        to={faces?.other ?? null}
      />
    </Link>
  );
};
