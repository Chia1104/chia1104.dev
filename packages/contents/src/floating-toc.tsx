"use client";

import { useEffect, useRef, useState } from "react";

import { Link, Popover, ScrollShadow } from "@heroui/react";
import type { TableOfContents } from "fumadocs-core/toc";
import { AnchorProvider, useActiveAnchor } from "fumadocs-core/toc";

interface FloatingTOCProps {
  toc: TableOfContents;
  label?: string;
}

interface FloatingTOCLinksProps extends FloatingTOCProps {
  activeUrl: string | undefined;
  onNavigate: () => void;
}

function FloatingTOCLinks({
  toc,
  label,
  activeUrl,
  onNavigate,
}: FloatingTOCLinksProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroll = scrollRef.current;
    const active = scroll?.querySelector<HTMLElement>(
      '[aria-current="location"]'
    );
    if (scroll && active) {
      scroll.scrollTop =
        active.offsetTop - scroll.clientHeight / 2 + active.offsetHeight / 2;
    }
  }, [activeUrl]);

  return (
    <ScrollShadow
      ref={scrollRef}
      className="relative max-h-[min(60dvh,480px)] overscroll-contain"
      hideScrollBar>
      <nav aria-label={label}>
        <p
          className="text-muted px-2 py-1.5 text-xs leading-4"
          aria-hidden="true">
          {label}
        </p>
        <ul className="m-0 list-none p-0">
          {toc.map((item) => (
            <li key={item.url}>
              <Link
                href={item.url}
                className="text-muted hover:text-foreground aria-[current=location]:text-foreground block truncate rounded-2xl px-2 py-1.5 text-xs leading-4 no-underline aria-[current=location]:font-semibold data-[depth=3]:ml-5 data-[depth=4]:ml-8 data-[depth=5]:ml-11 data-[depth=6]:ml-14 motion-reduce:transition-none"
                data-depth={item.depth}
                aria-current={item.url === activeUrl ? "location" : undefined}
                onPress={onNavigate}>
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </ScrollShadow>
  );
}

function FloatingTOCNavigation({
  toc,
  label = "On this page",
}: FloatingTOCProps) {
  const activeAnchor = useActiveAnchor();
  const [interaction, setInteraction] = useState<"hover" | "press" | null>(
    null
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const activeUrl = activeAnchor ? `#${activeAnchor}` : toc[0]?.url;

  const containsTarget = (target: EventTarget | null) =>
    target instanceof Node &&
    (triggerRef.current?.contains(target) ||
      contentRef.current?.contains(target));

  return (
    <div
      /* `--dock-width` is 0 until an agent dock opens; the rail then moves in with the page. */
      className="fixed top-1/2 right-[calc(var(--dock-width,0px)+max(4px,env(safe-area-inset-right)))] z-40 hidden -translate-y-1/2 transition-[right] duration-200 ease-out motion-reduce:transition-none sm:right-[calc(var(--dock-width,0px)+max(12px,env(safe-area-inset-right)))] sm:block [html[data-dock-resizing]_&]:transition-none"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          setInteraction((current) => current ?? "hover");
        }
      }}
      onPointerLeave={(event) => {
        if (
          !containsTarget(event.relatedTarget) &&
          !containsTarget(document.activeElement)
        )
          setInteraction(null);
      }}
      onBlur={(event) => {
        if (!containsTarget(event.relatedTarget)) setInteraction(null);
      }}>
      <Popover
        isOpen={interaction !== null}
        onOpenChange={(isOpen) => setInteraction(isOpen ? "press" : null)}>
        <Popover.Trigger<"button">
          ref={triggerRef}
          render={(props) => <button {...props} type="button" />}
          aria-label={label}
          className="flex min-h-8 w-9 items-center justify-end rounded-2xl p-2">
          <span
            className="grid max-h-[40dvh] w-full auto-rows-[8px] items-center justify-items-end overflow-hidden"
            aria-hidden="true">
            {toc.map((item) => (
              <span
                key={item.url}
                className="bg-muted/40 data-[active=true]:bg-foreground block h-0.5 w-full rounded-full transition-[width,background-color] duration-200 data-[active=true]:w-full! data-[depth=3]:w-2/3 data-[depth=4]:w-1/2 data-[depth=5]:w-2/5 data-[depth=6]:w-1/3 motion-reduce:transition-none"
                data-depth={item.depth}
                data-active={item.url === activeUrl}
              />
            ))}
          </span>
        </Popover.Trigger>
        <Popover.Content
          ref={contentRef}
          isNonModal={interaction === "hover"}
          aria-label={label}
          placement="left"
          offset={0}
          className="bg-surface/80 w-56 max-w-[calc(100vw-4rem)] p-1.5 backdrop-blur-sm motion-reduce:animate-none">
          <FloatingTOCLinks
            toc={toc}
            label={label}
            activeUrl={activeUrl}
            onNavigate={() => setInteraction(null)}
          />
        </Popover.Content>
      </Popover>
    </div>
  );
}

export function FloatingTOC(props: FloatingTOCProps) {
  if (props.toc.length === 0) return null;
  return (
    <AnchorProvider toc={props.toc} single>
      <FloatingTOCNavigation {...props} />
    </AnchorProvider>
  );
}
