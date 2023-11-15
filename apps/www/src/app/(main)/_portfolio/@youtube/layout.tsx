import { type ReactNode, type FC } from "react";
import { Chia } from "@/shared/meta/chia";

const YOUTUBE_URL = Chia.link.youtube_playlist;

const Layout: FC<{
  children: ReactNode;
}> = ({ children }) => {
  return (
    <div className="flex w-full flex-col">
      {children}
      <a
        href={YOUTUBE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:bg-secondary hover:dark:bg-primary group relative mt-7 inline-flex self-center rounded transition ease-in-out"
        aria-label="Open Youtube">
        <span className="c-button-secondary text-base after:content-['_↗'] group-hover:-translate-x-1 group-hover:-translate-y-1">
          Youtube
        </span>
      </a>
    </div>
  );
};

export default Layout;
