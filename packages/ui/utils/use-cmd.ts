"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useEffectEvent, useState } from "react";

/** Toggles an open state on ⌘/Ctrl + `cmd`. */
const useCMD = (
  defaultOpen = false,
  options?: {
    /** @default "k" */
    cmd?: string;
    onKeyDown?: (event: KeyboardEvent) => void;
  }
): [boolean, Dispatch<SetStateAction<boolean>>] => {
  const cmd = options?.cmd ?? "k";
  const [open, setOpen] = useState(defaultOpen);
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    options?.onKeyDown?.(event);
  });
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === cmd && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((open) => !open);
        onKeyDown(event);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [cmd]);
  return [open, setOpen];
};

export default useCMD;
