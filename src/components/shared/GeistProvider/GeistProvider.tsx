import { GeistProvider as GP } from "@geist-ui/core";
import type { FC, ReactNode } from "react";
import { useDarkMode, useIsMounted } from "@chia/hooks";

const GeistProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { isDarkMode } = useDarkMode();
  const isMounted = useIsMounted();

  return (
    <GP themeType={isMounted && isDarkMode ? "dark" : "light"}>{children}</GP>
  );
};

export default GeistProvider;
