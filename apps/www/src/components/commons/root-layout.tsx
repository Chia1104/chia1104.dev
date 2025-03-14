"use client";

import type { ReactNode, FC, ComponentPropsWithoutRef } from "react";

import type { Locale } from "next-intl";
import { ViewTransitions } from "next-view-transitions";

import { cn } from "@chia/ui/utils/cn.util";

interface Props {
  children: ReactNode;
  locale?: Locale;
  htmlProps?: ComponentPropsWithoutRef<"html">;
  bodyProps?: ComponentPropsWithoutRef<"body">;
}

const RootLayout: FC<Props> = ({ children, locale, htmlProps, bodyProps }) => {
  return (
    <ViewTransitions>
      <html lang={locale} suppressHydrationWarning {...htmlProps}>
        <body
          {...bodyProps}
          className={cn(
            "scrollbar-thin dark:scrollbar-thumb-dark scrollbar-thumb-light scrollbar-thumb-rounded-full",
            bodyProps?.className
          )}>
          {children}
        </body>
      </html>
    </ViewTransitions>
  );
};

export default RootLayout;
