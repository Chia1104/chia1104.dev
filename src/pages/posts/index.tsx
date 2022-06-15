import type { GetStaticProps, NextPage} from 'next'
import type { PostFrontMatter } from "@chia/utils/types/post";
import { Layout } from "@chia/components/globals/Layout";
import { getAllPosts } from "@chia/lib/mdx/services";
import { PostsList } from "@chia/components/pages/posts/PostsList";
import {Chia} from "@chia/utils/meta/chia";

interface Props {
    posts: PostFrontMatter[],
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
    const name = Chia.name;
    const title = Chia.title;
    const chinese_name = Chia.chineseName
    const description = Chia.content

    const posts = props.posts;

    return (
        <Layout
            title={`Blog | ${name} ${chinese_name} `}
            description={`${description} Welcome to my blog. I always try to make the best of my time.`}>
            <article className="main c-container">
                <h1 className="title py-10 self-start">
                    <span>{name}</span> | <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">Blog</span>
                </h1>
                <div className="flex flex-col w-full justify-center items-center">
                    <PostsList post={posts} />
                </div>
            </article>
        </Layout>
    )
}

export default PostsPage
