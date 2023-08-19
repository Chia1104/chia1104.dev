import { type ReactNode, type FC } from "react";
import { Chia } from "@/shared/meta/chia";

const GITHUB_URL = Chia.link.github;

const Layout: FC<{
  children: ReactNode;
}> = ({ children }) => {
  return (
    <div className="flex w-full flex-col">
      {children}
      <a
        href={`${GITHUB_URL}?tab=repositories`}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:bg-secondary hover:dark:bg-primary group relative mt-7 inline-flex self-center rounded transition ease-in-out"
        aria-label="Open GitHub">
        <span className="c-button-secondary text-base after:content-['_↗'] group-hover:-translate-x-1 group-hover:-translate-y-1">
          GitHub
        </span>
      </a>
    </div>
  );
};

export default Layout;
