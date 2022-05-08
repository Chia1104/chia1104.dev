import type { GetServerSideProps, NextPage} from 'next'
import { Head } from "../../components/globals/Layout/Head";
import { Footer } from "../../components/globals/Layout/Footer";
import { queryPosts } from "../../../firebase/posts/services";
import { Post } from "../../utils/types";

interface Props {
    posts: Post,
}

export const getServerSideProps: GetServerSideProps = async (context) => {
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
        <div className="c-container">
            <Head
                title="Post"
                description="Post page"
            />

            <main className="main">
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

            <Footer />
        </div>
    )
}

export default PostPage
