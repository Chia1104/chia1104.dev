"use client";

import type { ReactNode, FC, ComponentPropsWithoutRef } from "react";

import { cn } from "@chia/ui/utils/cn.util";
import type { Locale } from "next-intl";

interface Props {
  children: ReactNode;
  locale?: Locale;
  htmlProps?: ComponentPropsWithoutRef<"html">;
  bodyProps?: ComponentPropsWithoutRef<"body">;
}

const RootLayout: FC<Props> = ({ children, locale, htmlProps, bodyProps }) => {
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      {...htmlProps}
      className={cn(htmlProps?.className, "overscroll-none")}>
      <body
        {...bodyProps}
        className={cn(
          "scrollbar-thin dark:scrollbar-thumb-dark scrollbar-thumb-light scrollbar-thumb-rounded-full c-bg-primary antialiased",
          bodyProps?.className
        )}>
        {children}
      </body>
    </html>
  );
};

export default RootLayout;
