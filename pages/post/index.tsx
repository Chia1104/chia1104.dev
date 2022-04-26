import type { NextPage } from 'next'
import { Header } from "../../components/globals/Header";
import { Footer } from "../../components/globals/Footer";

const PostPage: NextPage = () => {
    return (
        <div className="c-container">
            <Header
                title="Post"
                description="Post page"
            />

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
