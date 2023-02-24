import { type FC } from "react";
import RepoItem from "./RepoItem";
import type { RepoGql } from "@chia/shared/types";

interface Props {
  repo: RepoGql[];
}

const ReposList: FC<Props> = ({ repo }) => {
  return (
    <div className="grid w-full grid-cols-1 gap-10 md:grid-cols-2 xl:grid-cols-3">
      {repo.map((repo: RepoGql) => (
        <a
          href={repo.node.url}
          target="_blank"
          rel="noopener noreferrer"
          key={repo.node.id}
          className="group relative inline-flex h-[150px] w-full rounded transition ease-in-out hover:bg-secondary hover:dark:bg-primary">
          <RepoItem repo={repo} />
        </a>
      ))}
    </div>
  );
};

export default ReposList;
