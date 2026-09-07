"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

/** Resolves to `false` to keep the operator on the current page. */
export type NavigationGuard = (href: string) => Promise<boolean>;

let current: NavigationGuard | null = null;

const leavesPage = (href: string) =>
  new URL(href, window.location.href).pathname !== window.location.pathname;

/** Asks the mounted guard before a navigation that leaves the current pathname. */
export const confirmNavigation = (href: string): Promise<boolean> =>
  current && leavesPage(href) ? current(href) : Promise.resolve(true);

/**
 * One page at a time holds the guard. While it is mounted, same-origin anchor clicks that leave
 * the page are routed through it as well, so `next/link` and plain `href`s cannot slip past.
 */
export const useNavigationGuard = (guard: NavigationGuard) => {
  const router = useRouter();
  useEffect(() => {
    current = guard;
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.origin !== window.location.origin ||
        !leavesPage(anchor.href)
      )
        return;
      event.preventDefault();
      const url = new URL(anchor.href);
      void guard(anchor.href).then((allowed) => {
        if (allowed) router.push(url.pathname + url.search + url.hash);
      });
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (current === guard) current = null;
    };
  }, [guard, router]);
};

/** Next's router behind the guard. Without a guard, or on the same pathname, it pushes at once. */
export const useGuardedRouter = () => {
  const router = useRouter();
  return useMemo(
    () => ({
      push: (href: string) => {
        if (!current || !leavesPage(href)) {
          router.push(href);
          return;
        }
        void current(href).then((allowed) => {
          if (allowed) router.push(href);
        });
      },
    }),
    [router]
  );
};
