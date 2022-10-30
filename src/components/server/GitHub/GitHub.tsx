import type { RepoGql } from "@chia/shared/types";
import ReposList from "./ReposList";
import { Chia } from "@chia/shared/meta/chia";
import { getBaseUrl } from "@chia/utils/getBaseUrl";
import { asyncComponent } from "@chia/utils/asyncComponent.util";
import { FC } from "react";

const GitHub: FC = asyncComponent(async () => {
  const GITHUB_URL = Chia.link.github;
  const github = (await fetch(`${getBaseUrl()}/api/github`, {
    cache: "no-store",
  }).then((res) => res.json())) as RepoGql[];

  return (
    <>
      <div className="w-full flex flex-col">
        <ReposList repo={github} />
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
});

export default GitHub;
