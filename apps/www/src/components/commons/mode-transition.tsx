"use client";

import { createContext, use, useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";

import { AsciiCurtain, AsciiCurtainPhase } from "@chia/shaders/ascii-curtain";
import type { AsciiCurtainPoint } from "@chia/shaders/ascii-curtain";

import { usePathname, useRouter } from "@/libs/i18n/navigation";
import { modeFaceOf } from "@/libs/mode-face";
import { SITE_MODE_HOME, siteModeOf } from "@/shared/site-mode";
import type { SiteMode } from "@/shared/site-mode";

/** How long the covered screen shows the portrait whole before it opens again. */
const HOLD_MS = 480;
/** The curtain's colours ease to the new mode's once it has landed; opening waits for them. */
const SETTLE_MS = 320;
/** A navigation that has not landed by now is not coming; the curtain opens on whatever is there. */
const STUCK_MS = 8000;
/** `ModeSwitch` marks itself with this; the curtain opens from the one on the page it lands on. */
const MODE_SWITCH_SELECTOR = "[data-mode-switch]";

interface ModeTransition {
  /** Goes to the home of `mode` behind the curtain, which spreads from `origin` or the middle. */
  switchTo: (mode: SiteMode, origin?: AsciiCurtainPoint) => void;
}

interface Run {
  mode: SiteMode;
  phase: AsciiCurtainPhase;
  origin: AsciiCurtainPoint;
  /** When the screen became fully covered; `null` while the cover is still spreading. */
  coveredAt: number | null;
}

const ModeTransitionContext = createContext<ModeTransition | null>(null);

const centerOf = (box: DOMRect): AsciiCurtainPoint => ({
  x: box.left + box.width / 2,
  y: box.top + box.height / 2,
});

const viewportCenter = (): AsciiCurtainPoint => ({
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
});

export const useModeTransition = () => {
  const transition = use(ModeTransitionContext);
  if (!transition) {
    throw new Error(
      "useModeTransition must be used within ModeTransitionProvider"
    );
  }
  return transition;
};

/**
 * Switches between site modes behind a curtain of glyphs: it spreads from where the reader
 * clicked, the route changes once the screen is covered, and it opens again from the new page's
 * mode switch. Lives above the mode frames, so one curtain spans the change of frame.
 */
export const ModeTransitionProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, startNavigation] = useTransition();
  const [run, setRun] = useState<Run | null>(null);
  const [face, setFace] = useState<{
    mode: SiteMode;
    bitmap: ImageBitmap;
  } | null>(null);

  const isHolding =
    run !== null &&
    run.phase === AsciiCurtainPhase.Cover &&
    run.coveredAt !== null;
  const hasArrived =
    isHolding && !isNavigating && siteModeOf(pathname) === run.mode;
  const coveredAt = run?.coveredAt ?? null;

  useEffect(() => {
    if (!isHolding || coveredAt === null) return;
    const delay = hasArrived
      ? Math.max(SETTLE_MS, HOLD_MS - (performance.now() - coveredAt))
      : STUCK_MS;
    const timer = setTimeout(() => {
      const target = document.querySelector(MODE_SWITCH_SELECTOR);
      setRun((current) =>
        current
          ? {
              ...current,
              phase: AsciiCurtainPhase.Reveal,
              origin: target
                ? centerOf(target.getBoundingClientRect())
                : current.origin,
            }
          : null
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [isHolding, hasArrived, coveredAt]);

  const transition: ModeTransition = {
    switchTo: (mode, origin) => {
      if (run !== null) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        router.push(SITE_MODE_HOME[mode]);
        return;
      }
      setRun({
        mode,
        phase: AsciiCurtainPhase.Cover,
        origin: origin ?? viewportCenter(),
        coveredAt: null,
      });
      void modeFaceOf(mode).then((bitmap) => {
        if (bitmap) setFace({ mode, bitmap });
      });
    },
  };

  const endPhase = (phase: AsciiCurtainPhase) => {
    if (phase === AsciiCurtainPhase.Reveal) {
      setRun(null);
      return;
    }
    if (!run) return;
    setRun({ ...run, coveredAt: performance.now() });
    startNavigation(() => {
      router.push(SITE_MODE_HOME[run.mode]);
    });
  };

  return (
    <ModeTransitionContext value={transition}>
      {children}
      {run ? (
        <AsciiCurtain
          phase={run.phase}
          origin={run.origin}
          image={face?.mode === run.mode ? face.bitmap : null}
          onPhaseEnd={endPhase}
          className="fixed inset-0 z-10000"
        />
      ) : null}
    </ModeTransitionContext>
  );
};
