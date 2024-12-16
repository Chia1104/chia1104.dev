"use client";

import type { LinkProps } from "@chia/ui/link";
import Link from "@chia/ui/link";
import { NavigationMenuLink } from "@chia/ui/navigation-menu";
import { cn } from "@chia/ui/utils/cn.util";

const ListItem = ({ className, title, children, ...props }: LinkProps) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          preview={false}
          className={cn(
            "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors",
            className
          )}
          {...props}>
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="text-muted-foreground line-clamp-2 text-sm leading-snug">
            {typeof children !== "function" && children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
};

export default ListItem;
