"use client";

import { type FC, memo } from "react";
import Link from "next/link";
import { cn } from "@chia/utils/cn.util";
import { useSelectedLayoutSegments } from "next/navigation";

const NavMenu: FC = () => {
  const selectedLayoutSegments = useSelectedLayoutSegments();
  return (
    <nav className="c-border-primary c-bg-secondary fixed top-0 z-50 flex h-[75px] w-screen items-center justify-center border-b-[1px] transition-all ease-in-out">
      <div className="container flex w-[100%]">
        <div className="flex w-[70%] items-center justify-start">
          <Link
            href="/"
            scroll
            className="subtitle hover:c-text-green-to-purple ml-3 transition ease-in-out">
            Chia1104
          </Link>
        </div>
        <div className="mr-3 flex w-[30%] items-center justify-end">
          <Link
            scroll
            className={cn(
              "c-link mr-4 flex py-3",
              selectedLayoutSegments[0] === "about" && "c-link-active"
            )}
            href="/about">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-1 h-5 w-5"
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
            <h2 className="hidden md:block">About</h2>
          </Link>
          <Link
            scroll
            className={cn(
              "c-link mr-4 flex py-3",
              selectedLayoutSegments[0] === "posts" && "c-link-active"
            )}
            href="/posts">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-1 h-5 w-5"
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
            <h2 className="hidden md:block">Blog</h2>
          </Link>
          <Link
            scroll
            className={cn(
              "c-link mr-4 flex py-3",
              selectedLayoutSegments[0] === "portfolio" && "c-link-active"
            )}
            href="/portfolio">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-1 h-5 w-5"
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
            <h2 className="hidden md:block">Portfolio</h2>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default memo(NavMenu);
