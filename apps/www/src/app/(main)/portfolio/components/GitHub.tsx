import type { RepoGql } from "@/shared/types/index.ts";
import ReposList from "./ReposList.tsx";
import { Chia } from "@/shared/meta/chia.ts";
import { asyncComponent } from "@/utils/asyncComponent.util.ts";
import { type FC } from "react";
import githubClient from "@/helpers/GraphQL/github/github.client.ts";
import { GET_REPOS } from "@/helpers/GraphQL/github/query/index.ts";

interface Props {
  repo?: RepoGql[];
}

const GitHub: FC<Props> = asyncComponent(async ({ repo }) => {
  const GITHUB_URL = Chia.link.github;
  try {
    const repos = repo
      ? repo
      : (
          await githubClient.request<
            {
              user: { repositories: { edges: RepoGql[] } };
            },
            { username: string; sort: string; limit: number }
          >({
            document: GET_REPOS,
            variables: {
              username: "chia1104",
              sort: "PUSHED_AT",
              limit: 6,
            },
          })
        ).user.repositories.edges;
    return (
      <div className="flex w-full flex-col">
        <ReposList repo={repos} />
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
          className="hover:bg-secondary hover:dark:bg-primary group relative mt-7 inline-flex self-center rounded transition ease-in-out"
          aria-label="Open GitHub">
          <span className="c-button-secondary text-base after:content-['_↗'] group-hover:-translate-x-1 group-hover:-translate-y-1">
            GitHub
          </span>
        </a>
      </div>
    );
  }
});

export default GitHub;
