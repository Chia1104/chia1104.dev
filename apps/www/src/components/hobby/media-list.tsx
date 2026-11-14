"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import type { MediaRow } from "@/shared/media";
import { useHobbyStore } from "@/stores/hobby/store";

const HOVER_QUERY = "(hover: hover)";

const subscribeHover = (onChange: () => void) => {
  const query = window.matchMedia(HOVER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** A row is in focus on a touch screen while it crosses this band in the middle of the viewport. */
const CENTRE_BAND = "-45% 0px -45% 0px";

const ROW_CLASS_NAME =
  "focus-visible:ring-focus grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 px-(--hobby-gutter) py-[0.3em] outline-none focus-visible:ring-2 focus-visible:ring-inset";

/**
 * Every logged work as one full-width line of type. The row under the pointer or the keyboard
 * takes the stage; where nothing hovers, the row in the middle of the screen does.
 */
export const MediaList = ({ rows }: { rows: readonly MediaRow[] }) => {
  const focusId = useHobbyStore((state) => state.focus?.id ?? null);
  const setFocus = useHobbyStore((state) => state.setFocus);
  const canHover = useSyncExternalStore(
    subscribeHover,
    () => window.matchMedia(HOVER_QUERY).matches,
    () => true
  );
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (canHover || !list.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = Number(entry.target.getAttribute("data-row"));
          const row = rows.find((candidate) => candidate.id === id);
          if (row) setFocus(row);
        }
      },
      { rootMargin: CENTRE_BAND }
    );
    for (const item of list.current.children) observer.observe(item);
    return () => observer.disconnect();
  }, [canHover, rows, setFocus]);

  // The stage outlives this list in the frame, so leaving the page hands it back.
  useEffect(() => () => setFocus(null), [setFocus]);

  return (
    <ul
      ref={list}
      className="group/list flex flex-col text-[clamp(1.75rem,5.4vw,5.25rem)] leading-[1.08] font-bold tracking-tight"
      onPointerLeave={canHover ? () => setFocus(null) : undefined}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocus(null);
      }}>
      {rows.map((row) => {
        const content = (
          <>
            <span className="line-clamp-2 text-pretty">{row.title}</span>
            <span className="text-muted flex gap-4 text-sm font-medium tracking-normal tabular-nums">
              <span>{row.kind}</span>
              {row.year === null ? null : <span>{row.year}</span>}
            </span>
          </>
        );
        return (
          <li
            key={row.id}
            data-row={row.id}
            data-active={focusId === row.id ? "" : undefined}
            className="transition-opacity duration-300 motion-reduce:transition-none group-has-[[data-active]]/list:[&:not([data-active])]:opacity-40"
            onPointerEnter={canHover ? () => setFocus(row) : undefined}>
            {row.href ? (
              <a
                href={row.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={row.hrefLabel}
                className={ROW_CLASS_NAME}
                onFocus={() => setFocus(row)}>
                {content}
              </a>
            ) : (
              <div className={ROW_CLASS_NAME}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
};
