"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { HobbyPinStage, useHobbyStore } from "@/stores/hobby/store";
import type { HobbyPin } from "@/stores/hobby/store";

/**
 * The part of a page the stage shows through. The stage draws `backdropUrl` in `color` while any
 * of it is on screen, and holds its frame once the reader has scrolled past it.
 */
export const StageWindow = ({
  color,
  backdropUrl,
  className,
  children,
}: {
  /** `#rrggbb`, or `null` to keep the idle colour. */
  color: string | null;
  backdropUrl: string | null;
  className?: string;
  children: ReactNode;
}) => {
  const element = useRef<HTMLElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  /** The pin this window last gave the stage. */
  const written = useRef<HobbyPin | null>(null);
  const pinned = useHobbyStore((state) => state.pinned);
  const setPinned = useHobbyStore((state) => state.setPinned);
  const pin = useMemo(
    () => ({
      color,
      backdropUrl,
      stage: onScreen ? HobbyPinStage.Live : HobbyPinStage.Held,
    }),
    [color, backdropUrl, onScreen]
  );

  useEffect(() => {
    if (!element.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setOnScreen(entry.isIntersecting);
    });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);

  // A work opened in a sheet over this page pins the stage itself and hands it back on closing.
  // Until then the pin is the sheet's: this window only replaces one it wrote, or none.
  useEffect(() => {
    if (pinned !== null && pinned !== written.current) return;
    if (pinned === pin) return;
    written.current = pin;
    setPinned(pin);
  }, [pinned, pin, setPinned]);

  // Apart from the effect above, so scrolling past never hands the stage back in between.
  useEffect(() => () => setPinned(null), [setPinned]);

  return (
    <header ref={element} className={className}>
      {children}
    </header>
  );
};
