import { FC } from 'react';
import { RepoItem } from "@chia/components/pages/portfolios/ReposList/RepoItem";
import { Repo } from '@chia/utils/types/repo';

interface Props {
    repo: Repo[]
}

export const ReposList: FC<Props> = ({repo}) => {
    return (
        <div>
            {
                repo.map((repo: Repo) => {
                    return (
                        <a href={repo.html_url} target="_blank" rel="noopener noreferrer" key={repo.id}>
                            <RepoItem repo={repo} />
                        </a>
                    )
                })
            }
        </div>
    )
}
