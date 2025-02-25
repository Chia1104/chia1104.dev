"use client";

import type { ReactNode, FC, ComponentPropsWithoutRef } from "react";

import { ViewTransitions } from "next-view-transitions";

import { cn } from "@chia/ui/utils/cn.util";

import type { I18N } from "@/utils/i18n";

interface Props {
  children: ReactNode;
  locale?: I18N;
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
