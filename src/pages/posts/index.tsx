import type { GetStaticProps, NextPage } from "next";
import type { PostFrontMatter } from "@chia/shared/types";
import { Layout } from "@chia/components/shared";
import { getAllPosts } from "@chia/helpers/mdx/services";
import { PostsList } from "@chia/components/pages/posts";
import { Chia } from "@chia/shared/meta/chia";
import { BASE_URL } from "@chia/shared/constants";

interface Props {
  posts: PostFrontMatter[];
}

export const getStaticProps: GetStaticProps = async () => {
  const posts = await getAllPosts();

  return {
    props: {
      posts: posts,
    },
  };
};

const PostsPage: NextPage<Props> = (props) => {
  const name = Chia.name;
  const chinese_name = Chia.chineseName;
  const description = Chia.content;

  const { posts } = props;

  return (
    <Layout
      canonicalUrl={`${BASE_URL}/posts`}
      title={`Blog | ${name} ${chinese_name} `}
      description={`${description} Welcome to my blog. I always try to make the best of my time.`}
      type="article">
      <article className="main c-container">
        <h1 className="title py-10 self-start">
          <span>{name}</span> |{" "}
          <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
            Blog
          </span>
        </h1>
        <div className="flex flex-col w-full justify-center items-center">
          <PostsList post={posts} />
        </div>
      </article>
    </Layout>
  );
};

export default PostsPage;
