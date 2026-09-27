import { useEffect, useState } from "react";

/**
 * True once the page has loaded and the main thread has gone idle. Optional heavy work waits for
 * it so its download and parse never compete with the first render.
 */
export const useIdle = (): boolean => {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let cancel: (() => void) | undefined;
    const schedule = () => {
      if ("requestIdleCallback" in window) {
        const id = window.requestIdleCallback(() => setIdle(true), {
          timeout: 4000,
        });
        cancel = () => window.cancelIdleCallback(id);
      } else {
        // Safari has no `requestIdleCallback`.
        const id = setTimeout(() => setIdle(true), 1000);
        cancel = () => clearTimeout(id);
      }
    };
    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", schedule, { once: true });
    }
    return () => {
      window.removeEventListener("load", schedule);
      cancel?.();
    };
  }, []);
  return idle;
};
