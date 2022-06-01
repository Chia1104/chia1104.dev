import type { GetStaticProps, NextPage} from 'next'
import type { PostFrontMatter } from "@chia/utils/types/post";
import { Layout } from "@chia/components/globals/Layout";
import { getAllPosts } from "@chia/lib/mdx/services";
import { PostsList } from "@chia/components/pages/posts/PostsList";
import { queryPosts } from "@chia/lib/firebase/posts/services";

interface Props {
    posts: PostFrontMatter[],
}

export const getStaticProps: GetStaticProps = async (context) => {
    const posts = await getAllPosts();
    // const posts = await queryPosts(20);

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
            <article className="main c-container">
                <h1 className="title py-10">
                    Blog posts
                </h1>
                <div className="flex flex-col w-full justify-center items-center">
                    <PostsList post={posts} />
                </div>
            </article>
        </Layout>
    )
}

export default PostsPage
