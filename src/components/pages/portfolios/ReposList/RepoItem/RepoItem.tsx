import { FC } from 'react';
import { Repo } from '@chia/utils/types/repo'
import ForkRightOutlinedIcon from '@mui/icons-material/ForkRightOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';

interface Props {
    repo: Repo
}

export const RepoItem: FC<Props> = ({repo}) => {
    return (
        <span className="c-button-secondary transform group-hover:-translate-x-1 group-hover:-translate-y-1 w-full h-full flex flex-col">
            <h1 className="text-2xl line-clamp-1 mb-2">{repo.name}</h1>
            <p className="c-description text-base line-clamp-2">{repo.description}</p>
            <div className="c-description mt-auto text-base flex">
                <span className="mr-5 flex items-center">{repo.language}</span>
                <span className="mr-5 flex items-center">
                    {
                        repo.stargazers_count > 0 ?
                            <StarIcon fontSize={'small'} /> : <StarBorderIcon fontSize={'small'} />
                    }
                    {repo.stargazers_count}
                </span>
                <span className="flex items-center">
                    <ForkRightOutlinedIcon fontSize={'small'}/>
                    {repo.forks_count}
                </span>
            </div>
        </span>
    )
}
