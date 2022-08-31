import { memo } from "react";
import type { FC } from "react";
import { Link } from "@chia/components/shared";
import cx from "classnames";
import { useRouter } from "next/router";

const NavMenu: FC = () => {
  const router = useRouter();

  return (
    <nav className="w-screen flex h-[75px] items-center top-0 fixed justify-center z-50 border-b-[1px] c-border-primary c-bg-secondary">
      <div className="flex container w-[100%]">
        <div className="flex items-center w-[70%] justify-start">
          <Link href="/">
            <a className="subtitle ml-3 hover:c-text-green-to-purple transition ease-in-out">
              Chia1104
            </a>
          </Link>
        </div>
        <div className="flex items-center w-[30%] justify-end mr-3">
          <Link href="/about/">
            <a
              className={cx(
                "flex c-link mr-4 py-3",
                router.asPath.includes("about") && "c-link-active"
              )}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
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
            </a>
          </Link>
          <Link href="/posts/">
            <a
              className={cx(
                "flex c-link mr-4 py-3",
                router.asPath.includes("posts") && "c-link-active"
              )}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
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
            </a>
          </Link>
          <Link href="/portfolio/">
            <a
              className={cx(
                "flex c-link mr-4 py-3",
                router.asPath.includes("portfolio") && "c-link-active"
              )}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
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
            </a>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default memo(NavMenu);
