"use client";

import React from "react";

import type { DrawerProps } from "@heroui/react";
import { Drawer as HDrawer, DrawerBody, DrawerContent } from "@heroui/react";
import { cn } from "@heroui/react";

const Drawer = React.forwardRef<
  HTMLDivElement,
  DrawerProps & {
    sidebarWidth?: number;
    sidebarPlacement?: "left" | "right";
  }
>(
  (
    {
      children,
      className,
      onOpenChange,
      isOpen,
      sidebarWidth = 288,
      classNames = {},
      sidebarPlacement = "left",
      motionProps: drawerMotionProps,
      ...props
    },
    ref
  ) => {
    const motionProps = React.useMemo(() => {
      if (!!drawerMotionProps && typeof drawerMotionProps === "object") {
        return drawerMotionProps;
      }

      return {
        variants: {
          enter: {
            x: 0,
            transition: {
              x: {
                duration: 0.3,
              },
            },
          },
          exit: {
            x: sidebarPlacement == "left" ? -sidebarWidth : sidebarWidth,
            transition: {
              x: {
                duration: 0.2,
              },
            },
          },
        },
      };
    }, [sidebarWidth, sidebarPlacement, drawerMotionProps]);

    return (
      <>
        <HDrawer
          ref={ref}
          {...props}
          classNames={{
            ...classNames,
            wrapper: cn("!w-[var(--sidebar-width)]", classNames?.wrapper, {
              "!items-start !justify-start ": sidebarPlacement === "left",
              "!items-end !justify-end": sidebarPlacement === "right",
            }),
            base: cn(
              "w-[var(--sidebar-width)] !m-0 p-0 h-full max-h-full",
              classNames?.base,
              className,
              {
                "inset-y-0 left-0 max-h-[none] rounded-l-none !justify-start":
                  sidebarPlacement === "left",
                "inset-y-0 right-0 max-h-[none] rounded-r-none !justify-end":
                  sidebarPlacement === "right",
              }
            ),
            body: cn("p-0", classNames?.body),
            closeButton: cn("z-50", classNames?.closeButton),
          }}
          isOpen={isOpen}
          motionProps={motionProps}
          radius="none"
          scrollBehavior="inside"
          style={
            {
              "--sidebar-width": `${sidebarWidth}px`,
            } as Record<string, string>
          }
          onOpenChange={onOpenChange}>
          <DrawerContent>
            <DrawerBody>{children}</DrawerBody>
          </DrawerContent>
        </HDrawer>
        <div
          className={cn(
            "hidden h-full max-w-[var(--sidebar-width)] overflow-x-hidden overflow-y-scroll sm:flex",
            className
          )}>
          {children}
        </div>
      </>
    );
  }
);

Drawer.displayName = "Drawer";

export default Drawer;
