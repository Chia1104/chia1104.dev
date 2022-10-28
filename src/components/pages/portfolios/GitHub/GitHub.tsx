import { type FC } from "react";
import type { RepoGql } from "@chia/shared/types";
import ReposList from "./ReposList";
import { Chia } from "@chia/shared/meta/chia";

interface Props {
  repoData: RepoGql[];
}

const GitHub: FC<Props> = ({ repoData }) => {
  const GITHUB_URL = Chia.link.github;

  return (
    <>
      <header className="title sm:self-start pt-10">
        <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
          GitHub Repositories
        </span>
      </header>
      <p className="c-description sm:self-start pb-7">
        What I currently work on
      </p>
      <div className="w-full flex flex-col">
        <ReposList repo={repoData} />
        <a
          href={`${GITHUB_URL}?tab=repositories`}
          target="_blank"
          rel="noopener noreferrer"
          className="group hover:bg-secondary hover:dark:bg-primary relative inline-flex transition ease-in-out rounded mt-7 self-center"
          aria-label="Open GitHub">
          <span className="c-button-secondary transform group-hover:-translate-x-1 group-hover:-translate-y-1 text-base after:content-['_↗']">
            GitHub
          </span>
        </a>
      </div>
    </>
  );
};

export default GitHub;
