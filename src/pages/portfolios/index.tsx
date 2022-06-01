import type { NextPage } from 'next'
import {Layout} from "@chia/components/globals/Layout";
import { useAppDispatch } from "@chia/src/hooks/useAppDispatch";
import { useAppSelector } from "@chia/src/hooks/useAppSelector";
import { useEffect } from "react";
import {selectAllRepos, selectAllReposLoading, selectAllReposError} from "@chia/store/modules/Github/github.slice";
import {getAllReposAsync} from "@chia/store/modules/Github/actions";
import {ReposList} from "@chia/components/pages/portfolios/ReposList";
import {ReposLoader} from "@chia/components/pages/portfolios/ReposLoader";
import { Repo } from '@chia/utils/types/repo';

interface repo {
    status: number;
    data: Repo[];
}

const PortfoliosPage: NextPage = () => {
    const dispatch = useAppDispatch()
    const allReposData = useAppSelector(selectAllRepos) as repo
    const allReposLoading = useAppSelector(selectAllReposLoading)
    const allReposError = useAppSelector(selectAllReposError)

    useEffect(() => {
        if (!allReposData.data || allReposData.status !== 200) dispatch(getAllReposAsync())
    }, [dispatch])

    return (
        <Layout
            title="Chia1104 - My portfolios"
            description="This is the portfolios page"
        >
            <article className="main c-container">
                <h1 className="title sm:self-start pt-10">
                    GitHub Repositories
                </h1>
                <h2 className="c-description sm:self-start pb-5">
                    What I currently work on
                </h2>
                <div className="w-full mb-20 flex flex-col">
                    {
                        allReposLoading === 'succeeded' ? <ReposList repo={allReposData.data} /> : <ReposLoader />
                    }
                    <a
                        href="https://github.com/Chia1104?tab=repositories"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group hover:bg-primary relative inline-flex transition ease-in-out rounded mt-7 self-center"
                    >
                        <span className="c-button-secondary transform group-hover:-translate-x-1 group-hover:-translate-y-1 text-base after:content-['_↗']">
                            More
                        </span>
                    </a>
                </div>
            </article>
        </Layout>
    )
}

export default PortfoliosPage
