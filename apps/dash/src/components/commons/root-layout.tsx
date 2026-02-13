"use client";

import type { ReactNode, FC, ComponentPropsWithoutRef } from "react";

import { cn } from "@chia/ui/utils/cn.util";

interface Props {
  children: ReactNode;
  htmlProps?: ComponentPropsWithoutRef<"html">;
  bodyProps?: ComponentPropsWithoutRef<"body">;
}

const RootLayout: FC<Props> = ({ children, htmlProps, bodyProps }) => {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      {...htmlProps}
      className={cn(htmlProps?.className, "overscroll-none")}>
      <body
        {...bodyProps}
        className={cn(
          "scrollbar-thin scrollbar-thumb-primary dark:scrollbar-thumb-secondary scrollbar-thumb-rounded-full overflow-x-hidden",
          bodyProps?.className
        )}>
        {children}
      </body>
    </html>
  );
};

export default RootLayout;
