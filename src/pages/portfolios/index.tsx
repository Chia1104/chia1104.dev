import type { NextPage } from 'next'
import {Layout} from "@/components/globals/Layout";

const PortfoliosPage: NextPage = () => {
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
