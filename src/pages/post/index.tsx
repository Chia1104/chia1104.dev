import type { GetStaticProps, NextPage} from 'next'
import { queryPosts } from "../../../firebase/posts/services";
import { Post } from "../../utils/types";
import {Layout} from "../../components/globals/Layout";

interface Props {
    posts: Post,
}

export const getStaticProps: GetStaticProps = async (context) => {
    const post = await queryPosts(10);

    // const params = context.params;
    return {
        props: {
            posts: post as Post,
        },
    };
};


const PostPage: NextPage<Props> = (props) => {
    const posts = props.posts;
    return (
        <Layout
            title="Post"
            description="Post page">
            <main className="main c-container">
                <h1 className="title">
                    POST Page
                </h1>
                <div>
                    {posts.map((post: Post) => {
                        return (
                            <div key={post.id} >
                                <h2>{post.title}</h2>
                            </div>
                        )
                    })}
                </div>
            </main>
        </Layout>
    )
}

export default PostPage
