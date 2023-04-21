import { useEffect, useState } from "react";
import useIsomorphicLayoutEffect from "./use-isomorphic-layout-effect";

type UseLockedBodyOutput = [boolean, (locked: boolean) => void];

const useLockedBody = (
  initialLocked = false,
  rootId = "root"
): UseLockedBodyOutput => {
  const [locked, setLocked] = useState(initialLocked);

  // Do the side effect before render
  useIsomorphicLayoutEffect(() => {
    if (!locked) {
      return;
    }

    // Save initial body style
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Lock body scroll
    document.body.style.overflow = "hidden";

    // Get the scrollBar width
    const root = document.getElementById(rootId);
    const scrollBarWidth = root ? root.offsetWidth - root.scrollWidth : 0;

    // Avoid width reflow
    if (scrollBarWidth) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;

      if (scrollBarWidth) {
        document.body.style.paddingRight = originalPaddingRight;
      }
    };
  }, [locked]);

  // Update state if initialValue changes
  useEffect(() => {
    if (locked !== initialLocked) {
      setLocked(initialLocked);
    }
  }, [initialLocked]);

  return [locked, setLocked];
};

export default useLockedBody;
