"use client";

import { useEffect, useLayoutEffect } from "react";

const useIsomorphicLayoutEffect =
  "window" in globalThis ? useLayoutEffect : useEffect;

export default useIsomorphicLayoutEffect;
