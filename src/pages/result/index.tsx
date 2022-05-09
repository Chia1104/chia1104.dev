import type { NextPage } from 'next'
import {Layout} from "../../components/globals/Layout";

const ResultPage: NextPage = () => {
    return (
        <Layout
            title="Result"
            description="This is the result page"
        >
            <main className="main c-container">
                <h1 className="title">
                    RESULT Page
                </h1>
            </main>
        </Layout>
    )
}

export default ResultPage
