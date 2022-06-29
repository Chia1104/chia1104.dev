import { FC, memo } from 'react';
import RepoItem from "@chia/components/pages/portfolios/GitHub/ReposList/RepoItem";
import type { Repo } from '@chia/utils/types/repo';

interface Props {
    repo: Repo[]
}

const ReposList: FC<Props> = ({repo}) => {
    return (
        <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
            {
                repo.map((repo: Repo) => (
                    <a
                        href={repo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        key={repo.id}
                        className="w-full group hover:bg-secondary hover:dark:bg-primary relative inline-flex transition ease-in-out rounded h-[150px]"
                    >
                        <RepoItem repo={repo} />
                    </a>
                ))
            }
        </div>
    )
}

export default memo(ReposList, (prev, next) => prev.repo === next.repo)
