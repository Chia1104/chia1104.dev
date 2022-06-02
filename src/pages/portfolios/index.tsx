import type { NextPage } from 'next'
import {Layout} from "@chia/components/globals/Layout";
import { useAppDispatch } from "@chia/src/hooks/useAppDispatch";
import { useAppSelector } from "@chia/src/hooks/useAppSelector";
import { useEffect, useState } from "react";
import {selectAllRepos, selectAllReposLoading, selectAllReposError} from "@chia/store/modules/Github/github.slice";
import {getAllReposAsync} from "@chia/store/modules/Github/actions";
import type { Repo } from '@chia/utils/types/repo';
import {GitHub} from "@chia/components/pages/portfolios/GitHub";
import {Youtube} from "@chia/components/pages/portfolios/Youtube";
import type { Youtube as y } from '@chia/utils/types/youtube';
import {getAllVideosAsync} from "@chia/store/modules/Youtube/actions";
import {selectAllVideos, selectAllVideosError, selectAllVideosLoading} from "@chia/store/modules/Youtube/youtube.slice";
import {getListImageUrl} from "@chia/lib/firebase/files/services";
import {Design} from "@chia/components/pages/portfolios/Design";

interface repo {
    status: number;
    data: Repo[];
}

interface video {
    status: number;
    data: y;
}

const PortfoliosPage: NextPage = () => {
    const dispatch = useAppDispatch()

    // GitHub Repos
    const allReposData = useAppSelector(selectAllRepos) as repo
    const allReposLoading = useAppSelector(selectAllReposLoading)
    const allReposError = useAppSelector(selectAllReposError)

    // Youtube Videos
    const allVideosData = useAppSelector(selectAllVideos) as video
    const allVideosLoading = useAppSelector(selectAllVideosLoading)
    const allVideosError = useAppSelector(selectAllVideosError)

    useEffect(() => {
        if (!allReposData.data || allReposData.status !== 200) dispatch(getAllReposAsync())
        if (!allVideosData.data || allVideosData.status !== 200) dispatch(getAllVideosAsync())
    }, [dispatch])

    return (
        <Layout
            title="Chia1104 - My portfolios"
            description="This is the portfolios page"
        >
            <article className="main c-container">
                <GitHub repoData={allReposData} loading={allReposLoading} error={allReposError}/>
                <hr className="my-10 c-border-primary border-t-2 w-full" />
                <Youtube videoData={allVideosData} loading={allVideosLoading} error={allVideosError}/>
                <hr className="my-10 c-border-primary border-t-2 w-full" />
                <Design />
            </article>
        </Layout>
    )
}

export default PortfoliosPage
