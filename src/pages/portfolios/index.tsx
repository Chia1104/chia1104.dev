import type { NextPage } from 'next'
import {Layout} from "@/components/globals/Layout";
import { useAppDispatch } from "@/src/hooks/useAppDispatch";
import { useAppSelector } from "@/src/hooks/useAppSelector";
import { useEffect } from "react";
import {selectAllRepos, selectAllReposLoading, selectAllReposError} from "@/store/modules/Github/github.slice";
import {getAllReposAsync} from "@/store/modules/Github/actions";

const PortfoliosPage: NextPage = () => {
    const dispatch = useAppDispatch()
    const allReposData = useAppSelector(selectAllRepos)
    const allReposLoading = useAppSelector(selectAllReposLoading)
    const allReposError = useAppSelector(selectAllReposError)

    // useEffect(() => {
    //     // @ts-ignore
    //     if (allReposData.length === 0) dispatch(getAllReposAsync())
    // }, [dispatch])

    return (
        <Layout
            title="Chia1104 - My portfolios"
            description="This is the portfolios page"
        >
            <article className="main c-container">
                <h1 className="title">
                    Portfolios Page
                </h1>
            </article>
        </Layout>
    )
}

export default PortfoliosPage
