import type { RepoGql } from "@chia/shared/types";
import ReposList from "./ReposList";
import { Chia } from "@chia/shared/meta/chia";
import { asyncComponent } from "@chia/utils/asyncComponent.util";
import { FC } from "react";
import githubGraphQLClient from "@chia/helpers/GraphQL/github/github.client";
import { GET_REPOS } from "@chia/helpers/GraphQL/github/query";

const GitHub: FC = asyncComponent(async () => {
  const GITHUB_URL = Chia.link.github;
  try {
    const { user } = await githubGraphQLClient.request(GET_REPOS, {
      username: "chia1104",
      sort: "PUSHED_AT",
      limit: 6,
    });
    const github: RepoGql[] = user.repositories.edges;

    return (
      <>
        <div className="flex w-full flex-col">
          <ReposList repo={github} />
          <a
            href={`${GITHUB_URL}?tab=repositories`}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative mt-7 inline-flex self-center rounded transition ease-in-out hover:bg-secondary hover:dark:bg-primary"
            aria-label="Open GitHub">
            <span className="c-button-secondary transform text-base after:content-['_↗'] group-hover:-translate-x-1 group-hover:-translate-y-1">
              GitHub
            </span>
          </a>
        </div>
      </>
    );
  } catch (error) {
    console.error(error);
    return (
      <div className="flex w-full flex-col">
        <p className="c-description pb-5 indent-4">
          Sorry, I can't get my GitHub repos now. Please try again later.
        </p>
        <a
          href={`${GITHUB_URL}?tab=repositories`}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative mt-7 inline-flex self-center rounded transition ease-in-out hover:bg-secondary hover:dark:bg-primary"
          aria-label="Open GitHub">
          <span className="c-button-secondary transform text-base after:content-['_↗'] group-hover:-translate-x-1 group-hover:-translate-y-1">
            GitHub
          </span>
        </a>
      </div>
    );
  }
});

export default GitHub;
