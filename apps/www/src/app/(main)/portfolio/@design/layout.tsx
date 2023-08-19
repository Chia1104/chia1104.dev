import { type ReactNode, type FC } from "react";
import { Chia } from "@/shared/meta/chia";

const POSTER_URL = Chia.link.google_photos;

const Layout: FC<{
  children: ReactNode;
}> = ({ children }) => {
  return (
    <>
      <header className="title c-text-bg-sec-half dark:c-text-bg-primary-half sm:self-start">
        Design
      </header>
      <p className="c-description pb-7 sm:self-start">Some of my design work</p>
      {children}
      <a
        href={POSTER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:bg-secondary hover:dark:bg-primary group relative mt-7 inline-flex self-center rounded transition ease-in-out"
        aria-label="Open Google Photos">
        <span className="c-button-secondary text-base after:content-['_↗'] group-hover:-translate-x-1 group-hover:-translate-y-1">
          Google Photos
        </span>
      </a>
    </>
  );
};

export default Layout;
