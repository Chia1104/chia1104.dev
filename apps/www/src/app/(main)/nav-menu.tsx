"use client";

import { type FC, memo } from "react";
import Link from "next/link";
import { cn, ToggleTheme, useDarkMode } from "@chia/ui";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "framer-motion";
import navItems from "@/shared/routes";

const Toggle: FC = () => {
  const { isDarkMode, toggle } = useDarkMode();
  return <ToggleTheme toggleTheme={toggle} isDark={isDarkMode} />;
};

const NavMenu: FC = () => {
  let pathname = usePathname() || "/";
  if (pathname.includes("/posts/")) {
    pathname = "/posts";
  }
  return (
    <nav className="c-bg-third fixed top-0 z-50 flex h-[75px] w-screen items-center justify-center">
      <div className="container flex w-[100%] px-5">
        <div className="flex w-[20%] items-center">
          <Link
            href="/"
            scroll
            className="subtitle hover:c-text-green-to-purple ml-3 transition ease-in-out">
            Chia1104
          </Link>
        </div>
        <LayoutGroup>
          <div className="mr-3 flex w-[80%] items-center justify-end">
            {Object.entries(navItems).map(([path, { name, icon }]) => {
              const isActive = path === pathname;
              return (
                <Link
                  key={path}
                  href={path}
                  className={cn(
                    "flex align-middle transition-all hover:text-neutral-800 dark:hover:text-neutral-200",
                    {
                      "text-neutral-500": !isActive,
                      "font-bold": isActive,
                    }
                  )}>
                  <span className="relative px-[10px] py-[5px]">
                    <p className="hidden md:block">{name}</p>
                    <div className="block md:hidden">{icon}</div>
                    {path === pathname ? (
                      <motion.div
                        className="absolute inset-0 z-[-1] rounded-md bg-[#dddddd] dark:bg-black/60"
                        layoutId="sidebar"
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 30,
                        }}
                      />
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </div>
          <Toggle />
        </LayoutGroup>
      </div>
    </nav>
  );
};

export default memo(NavMenu);
