"use client";

import type { ReactNode, FC, ComponentPropsWithoutRef } from "react";

import { cn } from "@chia/ui/utils/cn.util";

import { I18N } from "@/utils/i18n";

interface Props {
  children: ReactNode;
  locale?: I18N;
  htmlProps?: ComponentPropsWithoutRef<"html">;
  bodyProps?: ComponentPropsWithoutRef<"body">;
}

const RootLayout: FC<Props> = ({ children, locale, htmlProps, bodyProps }) => {
  return (
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
  );
};

export default RootLayout;
