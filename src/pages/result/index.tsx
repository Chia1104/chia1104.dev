import type { NextPage } from 'next'
import { Head } from "../../components/globals/Layout/Head";
import { Footer } from "../../components/globals/Layout/Footer";

const ResultPage: NextPage = () => {
    return (
        <div className="c-container">
            <Head
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
