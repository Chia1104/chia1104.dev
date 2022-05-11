import type { GetStaticProps, NextPage} from 'next'
import { Post } from "../../../utils/types/interfaces/post";
import { Layout } from "../../components/globals/Layout";
import { getAllPosts } from "../../../lib/mdx/services";
import Link from "next/link";

interface Props {
    posts: Post,
}

export const getStaticProps: GetStaticProps = async (context) => {
    const posts = await getAllPosts();

    posts
        .map((post) => post.data)
        .sort((foo, bar) => {
            if (foo.data.createdAt > bar.data.createdAt) return 1
            if (foo.data.createdAt < bar.data.createdAt) return -1

            return 0
        })

    return {
        props: {
            posts: posts.reverse(),
        },
    };
};


const PostsPage: NextPage<Props> = (props) => {
    const posts = props.posts;
    return (
        <Layout
            title="Chia1104 - Posts"
            description="Post page">
            <div className="main c-container">
                <h1 className="title">
                    POST Page
                </h1>
                <div>
                    {posts.map((post: Post) => {
                        return (
                            <Link href={`/posts/${post.slug}`} passHref key={post.id}>
                                <a >
                                    <h2>{post.title}</h2>
                                </a>
                            </Link>
                        )
                    })}
                </div>
            </div>
        </Layout>
    )
}

export default PostsPage
