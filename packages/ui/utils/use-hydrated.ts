import { useSyncExternalStore } from "react";

const subscribeNever = () => () => undefined;

/**
 * True only after hydration. The server HTML and the first client render agree, so anything
 * only the browser knows (locale, zone, theme, origin) renders on the second pass.
 */
export const useHydrated = (): boolean =>
  useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
