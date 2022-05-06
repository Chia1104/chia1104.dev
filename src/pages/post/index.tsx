import type { GetServerSideProps, NextPage} from 'next'
import { Header } from "../../components/globals/Layout/Header";
import { Footer } from "../../components/globals/Layout/Footer";
import { queryPosts } from "../../../firebase/posts/services";
import { useState } from "react";

export async function getServerSideProps() {
    const posts = await queryPosts(10);
    return {
        props: { posts }
    }
}


const PostPage: NextPage = (props) => {
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
