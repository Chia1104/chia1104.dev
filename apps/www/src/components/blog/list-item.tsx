"use client";

import type { LinkProps } from "next/link";
import Link from "next/link";

import { NavigationMenuLink } from "@chia/ui/navigation-menu";
import { cn } from "@chia/ui/utils/cn.util";

const ListItem = ({
  className,
  title,
  children,
  ...props
}: LinkProps & React.ComponentPropsWithoutRef<"a">) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          className={cn(
            "hover:bg-default hover:text-default-foreground focus:bg-default focus:text-default-foreground block space-y-1 rounded-md p-3 leading-none no-underline transition-colors outline-none select-none",
            className
          )}
          {...props}>
          <div className="text-sm leading-none font-medium">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug">
            {typeof children !== "function" && children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
};

export default ListItem;
