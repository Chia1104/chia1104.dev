import type { GetStaticProps, NextPage} from 'next'
import { Post } from "@/utils/types/interfaces/post";
import { Layout } from "@/components/globals/Layout";
import { getAllPosts } from "@/lib/mdx/services";
import { PostsList } from "@/components/pages/posts/PostsList";

interface Props {
    posts: Post,
}

export const getStaticProps: GetStaticProps = async (context) => {
    const posts = await getAllPosts();

    return {
        props: {
            posts: posts,
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
                <div className="flex flex-col lg:flex-row w-full lg:w-[40%] justify-center items-center">
                    <PostsList post={posts} />
                </div>
            </div>
        </Layout>
    )
}

export default PostsPage
