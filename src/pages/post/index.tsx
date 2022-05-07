import type { GetServerSideProps, NextPage} from 'next'
import { Header } from "../../components/globals/Layout/Header";
import { Footer } from "../../components/globals/Layout/Footer";
import { queryPosts } from "../../../firebase/posts/services";
import { Post } from "../../utils/types";

interface Props {
    posts: Post,
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const post = await queryPosts(10);

    const postExample = [
        {
            id: '1',
            title: 'title1',
            content: 'content1',
            createdAt: 1588888888,
            updatedAt: 1588888888,
            published: true,
        },
        {
            id: '2',
            title: 'title2',
            content: 'content2',
            createdAt: 1588888888,
            updatedAt: 1588888888,
            published: true,
        },
        {
            id: '3',
            title: 'title3',
            content: 'content3',
            createdAt: 1588888888,
            updatedAt: 1588888888,
            published: true,
        }
    ]


    const params = context.params;
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
            <Header
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
