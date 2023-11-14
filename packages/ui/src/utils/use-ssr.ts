"use client";

import { useEffect, useState } from "react";

const IS_BROWSER = typeof window !== "undefined";

interface SSRState {
  isBrowser: boolean;
  isServer: boolean;
}

const useSSR = () => {
  const [browser, setBrowser] = useState<boolean>(false);
  useEffect(() => {
    setBrowser(IS_BROWSER);
  }, []);

  return {
    isBrowser: browser,
    isServer: !browser,
  };
};

export default useSSR;
export type { SSRState };
