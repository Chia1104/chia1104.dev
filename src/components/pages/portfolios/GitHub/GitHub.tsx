import { FC } from 'react';
import type {Repo} from "@chia/utils/types/repo";
import {ReposList} from "@chia/components/pages/portfolios/GitHub/ReposList";
import {ReposLoader} from "@chia/components/pages/portfolios/GitHub/ReposLoader";
import { Chia } from '@chia/utils/meta/chia';

interface Props {
    repoData: {
        data: Repo[]
        status: number
    }
    loading: 'idle' | 'pending' | 'succeeded' | 'failed'
    error?: string
}

export const GitHub: FC<Props> = ({ repoData, loading, error }) => {
    const GITHUB_URL = Chia.link.github;

    return (
        <>
            <h1 className="title sm:self-start pt-10">
                <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">GitHub Repositories</span>
            </h1>
            <h2 className="c-description sm:self-start pb-5">
                What I currently work on
            </h2>
            <div className="w-full flex flex-col">
                {
                    loading === 'succeeded' && <ReposList repo={repoData.data} />
                }
                {
                    loading === 'pending' && <ReposLoader />
                }
                {
                    loading === 'failed' || repoData.status !== 200 && <p>{error}</p>
                }
                <a
                    href={`${GITHUB_URL}?tab=repositories`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group hover:bg-secondary hover:dark:bg-primary relative inline-flex transition ease-in-out rounded mt-7 self-center"
                    aria-label={'Open GitHub'}
                >
                    <span className="c-button-secondary transform group-hover:-translate-x-1 group-hover:-translate-y-1 text-base after:content-['_↗']">
                        GitHub
                    </span>
                </a>
            </div>
        </>
    )
}
