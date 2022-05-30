import { FC } from 'react';
import { Repo } from '@chia/utils/types/repo'

interface Props {
    repo: Repo
}

export const RepoItem: FC<Props> = ({repo}) => {
    return (
        <div>
            <h1>{repo.name}</h1>
            <p>{repo.description}</p>
            <p>{repo.updated_at}</p>
            <div>
                <span>{repo.language}</span>
                <span>{repo.stargazers_count}</span>
                <span>{repo.forks_count}</span>
            </div>
        </div>
    )
}
