"use client";

import { ViewTransitions } from "next-view-transitions";
import type { ReactNode, FC, ComponentPropsWithoutRef } from "react";

import { cn } from "@chia/ui/utils/cn.util";

interface Props {
  children: ReactNode;
  htmlProps?: ComponentPropsWithoutRef<"html">;
  bodyProps?: ComponentPropsWithoutRef<"body">;
}

const RootLayout: FC<Props> = ({ children, htmlProps, bodyProps }) => {
  return (
    <ViewTransitions>
      <html lang="en" suppressHydrationWarning {...htmlProps}>
        <body
          {...bodyProps}
          className={cn(
            "scrollbar-thin scrollbar-thumb-primary dark:scrollbar-thumb-secondary scrollbar-thumb-rounded-full overflow-x-hidden",
            bodyProps?.className
          )}>
          {children}
        </body>
      </html>
    </ViewTransitions>
  );
};

export default RootLayout;
