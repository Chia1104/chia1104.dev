import { Page } from "@chia/components/client";
import { getPost, getAllPosts } from "@chia/helpers/mdx/services";
import { MDXRemote } from "@chia/components/client";
import { type ReactNode } from "react";
// import * as mdxComponents from "@chia/components/pages/posts/MDXComponents";

export const generateStaticParams = async () => {
  const posts = await getAllPosts();

  return posts.map((post) => ({
    slug: post.slug,
  }));
};

const PostDetailPage = async ({
  params,
}: {
  params?: any;
  children?: ReactNode;
}) => {
  const { frontMatter, source } = await getPost(params.slug);

  return (
    <Page>
      <article className="main c-container mt-20">
        <h1 className="text-3xl mb-10">Work in progress</h1>
        <MDXRemote {...source} />
      </article>
    </Page>
  );
};

export default PostDetailPage;
