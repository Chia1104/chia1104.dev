import type { NextPage } from 'next'
import { Header } from "../../components/globals/Layout/Header";
import { Footer } from "../../components/globals/Layout/Footer";

const ResultPage: NextPage = () => {
    return (
        <div className="c-container">
            <Header
                title="Result"
                description="This is the result page"
            />

            <main className="main">
                <h1 className="title">
                    RESULT Page
                </h1>
            </main>

            <Footer />
        </div>
    )
}

export default ResultPage
