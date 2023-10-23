"use client";

import { type FC, memo } from "react";
import Link from "next/link";
import { cn, ToggleTheme } from "@chia/ui";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "framer-motion";
import { useDarkMode } from "@/hooks";

const navItems = {
  "/about": {
    name: "About",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
  "/posts": {
    name: "Blog",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
    ),
  },
  "/portfolio": {
    name: "Portfolio",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    ),
  },
  "/contact": {
    name: "Contact",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className="h-5 w-5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
        />
      </svg>
    ),
  },
};

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
