import type { NextPage } from 'next'
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";

const PostPage: NextPage = () => {
    return (
        <div className="c-container">
            <Header />

            <main className="main">
                <h1 className="title">
                    POST Page
                </h1>
            </main>

            <Footer />
        </div>
    )
}

export default PostPage
