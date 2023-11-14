"use client";

import { useEffect, useState } from "react";
import useSSR from "./use-ssr";

const createElement = (id: string): HTMLElement => {
  const el = document.createElement("div");
  el.setAttribute("id", id);
  return el;
};

const usePortal = (
  id: string,
  getContainer?: () => HTMLElement | null
): HTMLElement | null => {
  const _id = `__portal_${id}`;
  const { isBrowser } = useSSR();
  const [elSnapshot, setElSnapshot] = useState<HTMLElement | null>(
    isBrowser ? createElement(_id) : null
  );

  useEffect(() => {
    const customContainer = getContainer ? getContainer() : null;
    const parentElement = customContainer || document.body;
    const hasElement = parentElement.querySelector<HTMLElement>(`#${_id}`);
    const el = hasElement || createElement(_id);

    if (!hasElement) {
      parentElement.appendChild(el);
    }
    setElSnapshot(el);
  }, []);

  return elSnapshot;
};

export default usePortal;
