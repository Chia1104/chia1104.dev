import { useEffect, useState } from "react";

const IS_BROWSER = typeof window !== "undefined";

export type SSRState = {
  isBrowser: boolean;
  isServer: boolean;
};

const useSSR = (): SSRState => {
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
