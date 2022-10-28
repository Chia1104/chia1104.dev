"use client";

import { ThemeProvider } from "next-themes";
import { type ReactNode } from "react";

const NextThemeProvider = ({ children }: { children: ReactNode }) => {
  return (
    <ThemeProvider enableSystem={true} attribute="class">
      {children}
    </ThemeProvider>
  );
};

export default NextThemeProvider;
