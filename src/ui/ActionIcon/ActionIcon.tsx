"use client";

import { SiGithub, SiInstagram, SiLinkedin } from "react-icons/si";
import { type FC, memo } from "react";
import Contact from "./Contact";
import { useAppDispatch, useDarkMode, useIsMounted } from "@chia/hooks";
import { Chia } from "@chia/shared/meta/chia";
import { cn } from "@chia/utils/cn.util";
import { useAppSelector } from "@chia/hooks";
import {
  activeActionIconSheet,
  selectActionIconSheet,
} from "@chia/store/reducers/action-sheet";

const ActionIcon: FC = () => {
  const dispatch = useAppDispatch();
  const actionIconSheet = useAppSelector(selectActionIconSheet);
  const { isDarkMode, toggle } = useDarkMode();
  const isMounted = useIsMounted();

  const GITHUB = Chia.link.github;
  const INSTAGRAM = Chia.link.instagram;
  const LINKEDIN = Chia.link.linkedin;

  return (
    <div
      className={cn(
        "c-bg-secondary fixed bottom-0 right-0 z-40 mx-2 mb-10 flex flex-col items-center justify-center overflow-hidden rounded-xl p-3 shadow-2xl md:mr-10"
      )}>
      <Contact />
      <button
        aria-label={"Open contact"}
        onClick={() => dispatch(activeActionIconSheet())}
        className="transition ease-in-out hover:text-secondary">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mb-2 h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 15l7-7 7 7"
          />
        </svg>
      </button>
      <div className={cn("hidden md:flex", actionIconSheet && "flex")}>
        <button
          aria-label={"Light or Dark"}
          onClick={toggle}
          className="mr-3 transition ease-in-out hover:text-secondary">
          {isMounted && isDarkMode ? (
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
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          ) : (
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
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          )}
        </button>
        <div className="border-r" />
        <a
          href={GITHUB}
          target="_blank"
          rel="noreferrer"
          aria-label={"Open GitHub"}
          className="mx-3 transition ease-in-out hover:text-secondary">
          <SiGithub className="h-5 w-5" />
        </a>
        <a
          href={INSTAGRAM}
          target="_blank"
          rel="noreferrer"
          aria-label={"Open Instagram"}
          className="mr-3 transition ease-in-out hover:text-secondary">
          <SiInstagram className="h-5 w-5" />
        </a>
        <a
          href={LINKEDIN}
          target="_blank"
          rel="noreferrer"
          aria-label={"Open LinkedIn"}
          className="transition ease-in-out hover:text-secondary">
          <SiLinkedin className="h-5 w-5" />
        </a>
      </div>
    </div>
  );
};

export default memo(ActionIcon);
