"use client";

import type { ReactNode } from "react";

import { Drawer } from "@heroui/react";

import { cn } from "@chia/ui/utils/cn.util";
import useIsMobile from "@chia/ui/utils/use-is-mobile";

/** Every dashboard drawer: a wide right panel on a desktop, a bottom sheet with a handle on a phone. */
export const DrawerPanel = ({
  children,
  className,
  classNames,
}: {
  children: ReactNode;
  className?: string;
  classNames?: {
    content?: string;
    dialog?: string;
    handle?: string;
  };
}) => {
  const isMobile = useIsMobile("(max-width: 767px)");
  return (
    <Drawer.Content
      placement={isMobile ? "bottom" : "right"}
      className={classNames?.content}>
      <Drawer.Dialog
        className={cn(
          isMobile ? "max-h-[85dvh]" : "w-full max-w-3xl",
          className,
          classNames?.dialog
        )}>
        {isMobile ? <Drawer.Handle className={classNames?.handle} /> : null}
        {children}
      </Drawer.Dialog>
    </Drawer.Content>
  );
};
